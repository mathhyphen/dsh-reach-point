window.__ModuleLoader__.load({
	id: "dsh-reach-point",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		var react = require("react");
		var h = react.createElement;

		var USERS_URL = "/plugins/dsh-reach-point/api/users";
		var LOAD_BATCH_MAX = 30;
		var PREVIEW_CHARS = 300;
		var RAIL_LEFT_OFFSET = 128;
		var RAIL_TOP_OFFSET = 128;
		var RAIL_WIDTH = 36;

		function asText(value) {
			return value == null ? "" : String(value);
		}

		function media(query) {
			return typeof window.matchMedia === "function" ? window.matchMedia(query) : null;
		}

		function reducedMotion() {
			var query = media("(prefers-reduced-motion: reduce)");
			return query !== null && query.matches;
		}

		function colorLooksDark(value) {
			var match = asText(value).match(/rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:[ ,/]+([\d.]+))?/i);
			if (match === null || (match[4] !== undefined && Number(match[4]) === 0)) return undefined;
			var red = Number(match[1]) / 255;
			var green = Number(match[2]) / 255;
			var blue = Number(match[3]) / 255;
			return red * 0.2126 + green * 0.7152 + blue * 0.0722 < 0.5;
		}

		function darkTheme() {
			var root = document.documentElement;
			var body = document.body;
			var nodes = [body, root].filter(Boolean);

			for (var i = 0; i < nodes.length; i += 1) {
				if (nodes[i].hasAttribute("data-ds-dark-theme")) return true;
				var declared = asText(nodes[i].getAttribute("data-theme") || nodes[i].getAttribute("data-color-scheme")).toLowerCase();
				if (declared === "dark") return true;
				if (declared === "light") return false;
				if (nodes[i].classList.contains("dark")) return true;
				if (nodes[i].classList.contains("light")) return false;
			}

			for (var j = 0; j < nodes.length; j += 1) {
				var sampled = colorLooksDark(getComputedStyle(nodes[j]).backgroundColor);
				if (sampled !== undefined) return sampled;
			}
			var query = media("(prefers-color-scheme: dark)");
			return query !== null && query.matches;
		}

		function formatTime(value) {
			if (value === undefined || value === null || value === "") return "";
			var date = new Date(value);
			if (Number.isNaN(date.getTime())) return "";
			return String(date.getHours()).padStart(2, "0") + ":" + String(date.getMinutes()).padStart(2, "0");
		}

		function makeSessionIdSource(ctx) {
			var listeners = new Set();
			var snapshot;
			var disposed = false;
			function refresh() {
				if (disposed) return;
				var info = ctx.sessions.currentProvideInfo.getSnapshot();
				var next = info ? info.sessionId : undefined;
				if (next === snapshot) return;
				snapshot = next;
				listeners.forEach(function (listener) { listener(); });
			}
			var unsubscribe = ctx.sessions.currentProvideInfo.subscribe(refresh);
			refresh();
			return {
				getSnapshot: function () { return snapshot; },
				subscribe: function (listener) {
					listeners.add(listener);
					return function () { listeners.delete(listener); };
				},
				dispose: function () {
					disposed = true;
					unsubscribe();
					listeners.clear();
				},
			};
		}

		function flowOf() {
			return document.querySelector('[data-chat-flow=""]') || document.querySelector("[data-chat-flow]");
		}

		function scrollerOf(flow) {
			var declared = flow && flow.closest("[data-conversation-scroll]");
			if (declared !== null && declared !== undefined) return declared;
			for (var parent = flow && flow.parentElement; parent !== null && parent !== document.body; parent = parent.parentElement) {
				var overflow = getComputedStyle(parent).overflowY;
				if (overflow === "auto" || overflow === "scroll" || overflow === "overlay") return parent;
			}
			return document.scrollingElement || document.documentElement;
		}

		function flowVisible(node) {
			if (node === null) return false;
			if (typeof node.checkVisibility === "function") {
				try {
					return node.checkVisibility();
				} catch (error) {
					void error;
				}
			}
			var rect = node.getBoundingClientRect();
			return rect.width > 0 && rect.height > 0;
		}

		// Keep the rail inside the conversation center column band so it can never
		// drift over the sidebar or details panel; prefer the left gutter, fall back
		// to the right side of the flow, otherwise report "no room" via null.
		function railSpot(flow, flowRect) {
			var gap = 12;
			var minLeft = 4;
			var maxRight = window.innerWidth - 4;
			var container = typeof flow.closest === "function" ? flow.closest('[class*="centerCol"]') : null;
			if (container !== null) {
				var band = container.getBoundingClientRect();
				minLeft = Math.max(minLeft, band.left + 4);
				maxRight = Math.min(maxRight, band.right - 4);
			} else {
				// Degraded paths when the center-column class is renamed. First try
				// the stable shell anchor: the overlay outlet's parent is the layout
				// frame whose first grid child is always the sidebar column (data
				// attributes do not drift like hashed class names). Failing that,
				// walk the ancestor chain for any child element sitting entirely
				// left of the flow. Failing safe: minLeft only ever moves right.
				var measured = false;
				var overlayOutlet = document.querySelector("[data-shell-overlay]");
				var frameNode = overlayOutlet === null ? null : overlayOutlet.parentElement;
				var sideColumn = frameNode === null ? null : frameNode.firstElementChild;
				if (sideColumn !== null && !sideColumn.contains(flow)) {
					var frameEdge = sideColumn.getBoundingClientRect();
					if (frameEdge.width > 40 && frameEdge.height > 120 && frameEdge.right <= flowRect.left + 1) {
						minLeft = Math.max(minLeft, frameEdge.right + 6);
						measured = true;
					}
				}
				for (var node = flow.parentElement; measured === false && node !== null && node !== document.body; node = node.parentElement) {
					var sibling = node.firstElementChild;
					if (sibling === null || sibling.contains(flow)) continue;
					var edge = sibling.getBoundingClientRect();
					if (edge.width > 40 && edge.height > 120 && edge.right <= flowRect.left + 1) {
						minLeft = Math.max(minLeft, edge.right + 6);
						break;
					}
				}
			}
			var snugLeft = flowRect.left - RAIL_WIDTH - gap;
			if (snugLeft >= minLeft) {
				return Math.max(minLeft, Math.min(flowRect.left - RAIL_LEFT_OFFSET, snugLeft));
			}
			var rightSide = flowRect.right + gap;
			if (rightSide + RAIL_WIDTH + 4 <= maxRight) {
				return rightSide;
			}
			return null;
		}

		function anchorIndex() {
			var index = new Map();
			var rows = document.querySelectorAll("[data-chat-anchor-key]");
			for (var i = 0; i < rows.length; i += 1) {
				var key = rows[i].getAttribute("data-chat-anchor-key");
				if (key === null) continue;
				index.set(key, rows[i]);
				var marker = key.lastIndexOf(":input-message");
				if (marker !== -1) index.set(key.slice(marker + 14), rows[i]);
			}
			return index;
		}

		function findAnchor(id, index) {
			if (typeof id !== "string" || id === "") return null;
			return (index || anchorIndex()).get(id) || null;
		}

		function userRows() {
			var flow = flowOf();
			if (flow === null) return [];
			return Array.prototype.filter.call(flow.querySelectorAll("[data-time-hover-root]"), function (row) {
				return !row.hasAttribute("data-pending-steering") && !row.hasAttribute("data-turn-tail");
			});
		}

		function rowAnchor(row) {
			return row.closest("[data-chat-anchor-key]") || row.querySelector("[data-chat-anchor-key]") || row;
		}

		function historyKeys() {
			var flow = flowOf();
			if (flow === null) return [];
			return userRows().map(function (row, index) {
				var anchor = rowAnchor(row);
				return anchor.getAttribute("data-chat-anchor-key") || ("dom:" + index + ":" + asText(row.textContent).length);
			});
		}

		function sameKeys(left, right) {
			return left.length === right.length && left.every(function (key, index) { return key === right[index]; });
		}

		function isOlderPrepend(previous, next) {
			if (previous.length === 0 || next.length < previous.length) return false;
			var offset = next.length - previous.length;
			return previous.every(function (key, index) { return key === next[index + offset]; });
		}

		function normalizeItems(payload) {
			var values = payload && Array.isArray(payload.users) ? payload.users : [];
			return values.map(function (item, index) {
				item = item || {};
				var body = asText(item.text).trim();
				return {
					id: asText(item.id || item.messageId || item.key || ("remote-" + index)),
					seq: item.seq,
					time: item.time,
					text: body || "[无文本输入]",
				};
			}).filter(function (item) { return item.id !== ""; });
		}

		function domItems() {
			return userRows().map(function (row, index) {
				var anchor = rowAnchor(row);
				var key = anchor.getAttribute("data-chat-anchor-key") || ("dom-" + index);
				var bubble = row.querySelector('[class*="bubble"]');
				var body = bubble === null ? "[图片]" : (asText(bubble.textContent).trim() || "[无文本输入]");
				return { id: key, seq: index + 1, time: undefined, text: body, element: anchor };
			});
		}

		function olderButton() {
			var flow = flowOf();
			if (flow === null) return null;
			var buttons = flow.querySelectorAll("button");
			for (var i = 0; i < buttons.length; i += 1) {
				var label = asText(buttons[i].textContent || buttons[i].getAttribute("aria-label") || buttons[i].title);
				if (/load (older|earlier)|加载更早/i.test(label)) return buttons[i];
			}
			var firstAnchor = flow.querySelector("[data-chat-anchor-key]");
			if (firstAnchor !== null) {
				for (var j = 0; j < buttons.length; j += 1) {
					var precedesFirstMessage = (buttons[j].compareDocumentPosition(firstAnchor) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
					if (buttons[j].disabled && precedesFirstMessage) return buttons[j];
				}
			}
			return null;
		}

		function previewParts(value) {
			var body = asText(value).trim();
			if (body.length > PREVIEW_CHARS) body = body.slice(0, PREVIEW_CHARS) + "…";
			var newline = body.indexOf("\n");
			var title = newline === -1 ? body : body.slice(0, newline);
			var detail = newline === -1 ? "" : body.slice(newline + 1).trim();
			if (title.length > 72) {
				detail = title.slice(72).trim() + (detail ? "\n" + detail : "");
				title = title.slice(0, 72) + "…";
			}
			return { title: title || "输入", detail: detail };
		}

		var CSS_TEXT = `
.dsh-reach-point-rail {
  --rp-mark: rgba(98, 103, 112, .48);
  --rp-mark-hover: rgba(49, 53, 61, .72);
  --rp-mark-active: #202124;
  --rp-card: rgba(255, 255, 255, .98);
  --rp-card-text: #25272d;
  --rp-card-muted: #8a8f99;
  --rp-card-border: rgba(18, 22, 31, .09);
  --rp-card-shadow: 0 10px 28px rgba(24, 29, 39, .13), 0 2px 8px rgba(24, 29, 39, .06);
  position: fixed;
  z-index: 1000;
  width: 36px;
  box-sizing: border-box;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 6px 0;
  border-radius: 10px;
  scrollbar-width: none;
  -ms-overflow-style: none;
  overscroll-behavior: contain;
  pointer-events: auto;
  user-select: none;
}
.dsh-reach-point-rail[data-rp-theme="dark"] {
  --rp-mark: rgba(176, 182, 194, .48);
  --rp-mark-hover: rgba(222, 226, 234, .76);
  --rp-mark-active: #f2f4f8;
  --rp-card: rgba(34, 38, 46, .98);
  --rp-card-text: #f0f2f6;
  --rp-card-muted: #9da4b2;
  --rp-card-border: rgba(255, 255, 255, .09);
  --rp-card-shadow: 0 12px 30px rgba(0, 0, 0, .46), 0 2px 8px rgba(0, 0, 0, .25);
}
.dsh-reach-point-rail::-webkit-scrollbar { display: none; }
.dsh-reach-point-tick {
  appearance: none;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  width: 34px;
  height: 11px;
  margin: 0;
  padding: 0 0 0 4px;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
}
.dsh-reach-point-mark {
  display: block;
  width: 6px;
  height: 2px;
  border-radius: 999px;
  background: var(--rp-mark);
  transform-origin: left center;
  transition: width 130ms ease, height 130ms ease, background-color 130ms ease, opacity 130ms ease;
}
.dsh-reach-point-tick:hover .dsh-reach-point-mark,
.dsh-reach-point-tick:focus-visible .dsh-reach-point-mark { width: 15px; background: var(--rp-mark-hover); }
.dsh-reach-point-tick[aria-current="step"] .dsh-reach-point-mark { width: 24px; height: 2px; background: var(--rp-mark-active); opacity: 1; }
.dsh-reach-point-tick[data-rp-unloaded="true"] .dsh-reach-point-mark { opacity: .45; }
.dsh-reach-point-tick:focus-visible { outline: 1px solid var(--rp-mark-hover); outline-offset: -1px; border-radius: 4px; }
.dsh-reach-point-preview {
  position: fixed;
  z-index: 1001;
  box-sizing: border-box;
  width: 278px;
  max-width: calc(100vw - 24px);
  max-height: 210px;
  overflow: hidden;
  padding: 10px 12px 11px;
  border: 1px solid var(--rp-card-border);
  border-radius: 13px;
  background: var(--rp-card);
  color: var(--rp-card-text);
  box-shadow: var(--rp-card-shadow);
  pointer-events: none;
  text-align: left;
  animation: reachPointPreviewIn 120ms ease-out;
}
.dsh-reach-point-preview-title { overflow: hidden; font-size: 13px; font-weight: 600; line-height: 1.45; white-space: nowrap; text-overflow: ellipsis; }
.dsh-reach-point-preview-body { display: -webkit-box; overflow: hidden; margin-top: 4px; color: var(--rp-card-muted); font-size: 12px; line-height: 1.55; white-space: pre-wrap; word-break: break-word; -webkit-box-orient: vertical; -webkit-line-clamp: 6; }
.dsh-reach-point-preview-meta { display: flex; align-items: center; gap: 7px; margin-top: 9px; color: var(--rp-card-muted); font-size: 11px; line-height: 1.3; }
.dsh-reach-point-preview-dot { width: 5px; height: 5px; flex: none; border-radius: 50%; background: var(--rp-mark-active); opacity: .55; }
[data-dsh-reach-point-target] { outline: 2px solid rgba(91, 99, 236, .72); outline-offset: 3px; transition: outline-color 900ms ease; }
@keyframes reachPointPreviewIn { from { opacity: 0; transform: translateX(-3px); } to { opacity: 1; transform: translateX(0); } }
@media (max-width: 760px) { .dsh-reach-point-rail { display: none !important; } }
@media (prefers-reduced-motion: reduce) {
  .dsh-reach-point-mark, [data-dsh-reach-point-target] { transition: none; }
  .dsh-reach-point-preview { animation: none; }
}
`;

		function ReachPointRail(props) {
			var railRef = react.useRef(null);
			var timerRef = react.useRef(new Set());
			var targetRef = react.useRef(new Set());
			var disposedRef = react.useRef(false);
			var wheelAtRef = react.useRef(0);
			var remoteState = react.useState([]);
			var remoteItems = remoteState[0];
			var setRemoteItems = remoteState[1];
			var activeState = react.useState("");
			var activeId = activeState[0];
			var setActiveId = activeState[1];
			var hoverState = react.useState(null);
			var hover = hoverState[0];
			var setHover = hoverState[1];
			var domState = react.useState(0);
			var domTick = domState[0];
			var setDomTick = domState[1];
			var remoteRevisionState = react.useState(0);
			var remoteRevision = remoteRevisionState[0];
			var setRemoteRevision = remoteRevisionState[1];
			var themeState = react.useState(0);
			var themeTick = themeState[0];
			var setThemeTick = themeState[1];
			var pageState = react.useState(function () {
				var initial = flowOf();
				return initial !== null && flowVisible(initial);
			});
			var pageVisible = pageState[0];
			var setPageVisible = pageState[1];
			var sessionId = props && props.useSessionId ? props.useSessionId(function (value) { return value; }) : undefined;
			var domRoster = react.useMemo(function () { return domItems(); }, [sessionId, domTick]);
			var roster = remoteItems.length > 0 ? remoteItems : domRoster;
			var anchors = react.useMemo(function () { return anchorIndex(); }, [sessionId, domTick]);

			function schedule(callback, delay) {
				var id = window.setTimeout(function () {
					timerRef.current.delete(id);
					if (!disposedRef.current) callback();
				}, delay);
				timerRef.current.add(id);
				return id;
			}

			function locate(item) {
				var direct = item.element && item.element.isConnected ? item.element : findAnchor(item.id);
				if (direct !== null && direct !== undefined) return Promise.resolve(direct);
				return new Promise(function (resolve) {
					var clicks = 0;
					var polls = 0;
					var missingPolls = 0;
					var pagingButton = null;
					function step() {
						if (disposedRef.current) { resolve(null); return; }
						var found = findAnchor(item.id);
						if (found !== null) { resolve(found); return; }
						var button = pagingButton !== null && pagingButton.isConnected ? pagingButton : olderButton();
						if (clicks >= LOAD_BATCH_MAX || polls >= LOAD_BATCH_MAX * 4) { resolve(null); return; }
						if (button === null) {
							missingPolls += 1;
							if (missingPolls >= 12) { resolve(null); return; }
							polls += 1;
							schedule(step, 220);
							return;
						}
						missingPolls = 0;
						pagingButton = button;
						polls += 1;
						if (!button.disabled) { clicks += 1; button.click(); }
						schedule(step, button.disabled ? 220 : 400);
					}
					step();
				});
			}

			function reveal(target) {
				if (target === null || !target.isConnected) return;
				target.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "center" });
				target.setAttribute("data-dsh-reach-point-target", "");
				targetRef.current.add(target);
				schedule(function () {
					target.removeAttribute("data-dsh-reach-point-target");
					targetRef.current.delete(target);
				}, 1200);
			}

			function jump(item) {
				if (!item) return;
				setActiveId(item.id);
				locate(item).then(function (target) { if (!disposedRef.current && target !== null) reveal(target); });
			}

			function activeIndex() {
				for (var i = 0; i < roster.length; i += 1) if (roster[i].id === activeId) return i;
				return -1;
			}

			function move(delta) {
				if (roster.length === 0) return;
				var index = activeIndex();
				if (index < 0) index = delta > 0 ? -1 : roster.length;
				index = Math.max(0, Math.min(roster.length - 1, index + delta));
				jump(roster[index]);
			}

			react.useEffect(function () {
				disposedRef.current = false;
				return function () {
					disposedRef.current = true;
					timerRef.current.forEach(function (id) { window.clearTimeout(id); });
					timerRef.current.clear();
					targetRef.current.forEach(function (target) { target.removeAttribute("data-dsh-reach-point-target"); });
					targetRef.current.clear();
				};
			}, []);

			react.useEffect(function () {
				setRemoteItems([]);
				setActiveId("");
				setHover(null);
			}, [sessionId]);

			react.useEffect(function () {
				if (typeof sessionId !== "string" || sessionId === "") return;
				var alive = true;
				var aborter = typeof AbortController === "function" ? new AbortController() : null;
				var delay = remoteRevision === 0 ? 0 : 350;
				var timer = window.setTimeout(function () {
					var url = new URL(USERS_URL, window.location.origin);
					url.searchParams.set("sessionId", sessionId);
					fetch(url.href, aborter === null ? undefined : { signal: aborter.signal })
						.then(function (response) { if (!response.ok) throw new Error("history request failed"); return response.json(); })
						.then(function (payload) { if (alive) setRemoteItems(normalizeItems(payload)); })
						.catch(function () { if (alive) setRemoteItems([]); });
				}, delay);
				return function () {
					alive = false;
					window.clearTimeout(timer);
					if (aborter !== null) aborter.abort();
				};
			}, [sessionId, remoteRevision]);

			react.useEffect(function () {
				var frame = 0;
				var last = historyKeys();
				function inspect() {
					frame = 0;
					// While the conversation flow is absent (trajectory view, page
					// takeovers) the key snapshot collapses to empty; updating state
					// here would churn remote refetches on quick view flips.
					if (flowOf() === null) return;
					var next = historyKeys();
					if (sameKeys(next, last)) return;
					var prependOnly = isOlderPrepend(last, next);
					last = next;
					setDomTick(function (value) { return value + 1; });
					if (!prependOnly) setRemoteRevision(function (value) { return value + 1; });
				}
				var observer = typeof MutationObserver === "function" ? new MutationObserver(function (changes) {
					var external = changes.some(function (change) {
						return !(change.target instanceof Element) || change.target.closest(".dsh-reach-point-rail") === null;
					});
					if (external && frame === 0) frame = requestAnimationFrame(inspect);
				}) : null;
				if (observer !== null && document.body !== null) observer.observe(document.body, { childList: true, subtree: true });
				return function () { if (observer !== null) observer.disconnect(); if (frame !== 0) cancelAnimationFrame(frame); };
			}, [sessionId]);

			react.useEffect(function () {
				function changed() { setThemeTick(function (value) { return value + 1; }); }
				var observer = typeof MutationObserver === "function" ? new MutationObserver(changed) : null;
				var options = { attributes: true, attributeFilter: ["data-ds-dark-theme", "data-theme", "data-color-scheme", "class", "style"] };
				if (observer !== null) {
					observer.observe(document.documentElement, options);
					if (document.body !== null) observer.observe(document.body, options);
				}
				var query = media("(prefers-color-scheme: dark)");
				if (query !== null) {
					if (typeof query.addEventListener === "function") query.addEventListener("change", changed);
					else if (typeof query.addListener === "function") query.addListener(changed);
				}
				return function () {
					if (observer !== null) observer.disconnect();
					if (query !== null) {
						if (typeof query.removeEventListener === "function") query.removeEventListener("change", changed);
						else if (typeof query.removeListener === "function") query.removeListener(changed);
					}
				};
			}, []);

			// Session-page watcher: the rail may only live on the conversation page.
			// Page takeovers (SSH/task board) hide the conversation subtree via html
			// attributes + CSS without childList mutations, so watch documentElement
			// attributes and the flow element's own box (0x0 while hidden) instead.
			react.useEffect(function () {
				var disposed = false;
				var frame = 0;
				var watched = null;
				var resize = typeof ResizeObserver === "function" ? new ResizeObserver(schedule) : null;

				function watch(node) {
					if (resize === null || watched === node) return;
					resize.disconnect();
					watched = node;
					if (node !== null) resize.observe(node);
				}

				function evaluate() {
					frame = 0;
					if (disposed) return;
					var flow = flowOf();
					watch(flow);
					var active = flow !== null && flowVisible(flow);
					setPageVisible(function (current) { return current === active ? current : active; });
				}

				function schedule() { if (frame === 0) frame = requestAnimationFrame(evaluate); }

				var mutation = typeof MutationObserver === "function" ? new MutationObserver(schedule) : null;
				if (mutation !== null) {
					// Attribute changes cover CSS-takeover page switches (other pages
					// flip html attributes and hide the conversation via CSS); childList
					// covers remount-style navigation where the conversation subtree is
					// inserted back without any attribute change. Both must wake the
					// visibility check or the rail gets stuck hidden.
					mutation.observe(document.documentElement, { attributes: true });
					if (document.body !== null) {
						mutation.observe(document.body, { attributes: true });
						mutation.observe(document.body, { childList: true, subtree: true });
					}
				}
				window.addEventListener("resize", schedule);
				evaluate();
				return function () {
					disposed = true;
					if (frame !== 0) cancelAnimationFrame(frame);
					if (mutation !== null) mutation.disconnect();
					if (resize !== null) resize.disconnect();
					window.removeEventListener("resize", schedule);
				};
			}, []);

			react.useEffect(function () {
				var rail = railRef.current;
				if (rail === null || !pageVisible) return;
				var flow = flowOf();
				if (flow === null || !flowVisible(flow)) return;
				var scroller = scrollerOf(flow);
				var documentScroller = scroller === document.scrollingElement || scroller === document.documentElement || scroller === document.body;
				var scrollTarget = documentScroller ? window : scroller;
				var frame = 0;

				function boundsOfScroller() {
					if (documentScroller) return { top: 0, bottom: window.innerHeight, height: window.innerHeight };
					var rect = scroller.getBoundingClientRect();
					return { top: rect.top, bottom: rect.bottom, height: rect.height };
				}

				function sync() {
					frame = 0;
					if (!flowVisible(flow)) { rail.hidden = true; return; }
					var flowRect = flow.getBoundingClientRect();
					var bounds = boundsOfScroller();
					var top = Math.max(8, bounds.top + RAIL_TOP_OFFSET);
					var bottom = Math.min(window.innerHeight - 8, bounds.bottom - 12);
					var height = Math.max(0, bottom - top);
					var left = railSpot(flow, flowRect);
					var visible = roster.length >= 2 && window.innerWidth > 760 && height >= 72 && left !== null;
					rail.hidden = !visible;
					if (!visible) return;
					rail.style.left = left + "px";
					rail.style.top = top + "px";
					rail.style.height = height + "px";

					var readingLine = bounds.top + Math.min(96, Math.max(28, bounds.height * 0.2));
					var before = null;
					var after = null;
					roster.forEach(function (item) {
						var node = item.element && item.element.isConnected ? item.element : findAnchor(item.id, anchors);
						if (node === null || node === undefined) return;
						var itemTop = node.getBoundingClientRect().top;
						if (itemTop <= readingLine && (before === null || itemTop > before.top)) before = { id: item.id, top: itemTop };
						if (itemTop > readingLine && (after === null || itemTop < after.top)) after = { id: item.id, top: itemTop };
					});
					var next = before || after;
					if (next !== null) setActiveId(function (current) { return current === next.id ? current : next.id; });
				}

				function scheduleSync() { if (frame === 0) frame = requestAnimationFrame(sync); }
				sync();
				var resize = typeof ResizeObserver === "function" ? new ResizeObserver(scheduleSync) : null;
				if (resize !== null) { resize.observe(flow); if (!documentScroller) resize.observe(scroller); }
				window.addEventListener("resize", scheduleSync);
				scrollTarget.addEventListener("scroll", scheduleSync, { passive: true });
				return function () {
					if (frame !== 0) cancelAnimationFrame(frame);
					if (resize !== null) resize.disconnect();
					window.removeEventListener("resize", scheduleSync);
					scrollTarget.removeEventListener("scroll", scheduleSync);
				};
			}, [sessionId, domTick, remoteItems, pageVisible]);

			react.useEffect(function () {
				var rail = railRef.current;
				if (rail === null || activeId === "") return;
				var current = rail.querySelector('[aria-current="step"]');
				if (current === null) return;
				var railRect = rail.getBoundingClientRect();
				var itemRect = current.getBoundingClientRect();
				if (itemRect.top < railRect.top) rail.scrollTop -= railRect.top - itemRect.top;
				else if (itemRect.bottom > railRect.bottom) rail.scrollTop += itemRect.bottom - railRect.bottom;
			}, [activeId, roster.length]);

			react.useEffect(function () {
				var rail = railRef.current;
				if (rail === null) return;
				function wheel(event) {
					if (event.deltaY === 0) return;
					event.preventDefault();
					var now = Date.now();
					if (now - wheelAtRef.current < 110) return;
					wheelAtRef.current = now;
					move(event.deltaY > 0 ? 1 : -1);
				}
				rail.addEventListener("wheel", wheel, { passive: false });
				return function () { rail.removeEventListener("wheel", wheel); };
			}, [activeId, remoteItems, domTick]);

			if (!pageVisible || roster.length < 2) return null;
			var theme = darkTheme() ? "dark" : "light";
			void themeTick;

			function onKeyDown(event) {
				if (event.key === "ArrowDown" || event.key === "ArrowRight") { event.preventDefault(); move(1); return; }
				if (event.key === "ArrowUp" || event.key === "ArrowLeft") { event.preventDefault(); move(-1); return; }
				if (event.key === "Home") { event.preventDefault(); jump(roster[0]); return; }
				if (event.key === "End") { event.preventDefault(); jump(roster[roster.length - 1]); return; }
				if ((event.key === "Enter" || event.key === " ") && event.target === event.currentTarget) {
					event.preventDefault();
					var index = activeIndex();
					jump(roster[index < 0 ? 0 : index]);
				}
			}

			var pagingButton = olderButton();
			var historyExhausted = pagingButton === null || Boolean(pagingButton.disabled);
			var ticks = roster.map(function (item, index) {
				var selected = item.id === activeId;
				var unloaded = !historyExhausted && !(item.element && item.element.isConnected) && findAnchor(item.id, anchors) === null;
				var label = "跳转到输入 " + (index + 1) + "：" + item.text.replace(/\s+/g, " ").slice(0, 80);
				return h("button", {
					key: item.id,
					type: "button",
					className: "dsh-reach-point-tick",
					"aria-label": label,
					"aria-current": selected ? "step" : undefined,
					"aria-describedby": hover && hover.index === index ? "dsh-reach-point-preview" : undefined,
					"data-rp-unloaded": unloaded ? "true" : undefined,
					onMouseEnter: function (event) { setHover({ item: item, index: index, rect: event.currentTarget.getBoundingClientRect() }); },
					onFocus: function (event) { setHover({ item: item, index: index, rect: event.currentTarget.getBoundingClientRect() }); },
					onMouseLeave: function () { setHover(null); },
					onBlur: function () { setHover(null); },
					onClick: function () { jump(item); },
				}, h("span", { className: "dsh-reach-point-mark", "aria-hidden": "true" }));
			});

			var preview = null;
			if (hover !== null) {
				var parts = previewParts(hover.item.text);
				var left = Math.max(8, Math.min(window.innerWidth - 290, hover.rect.right + 9));
				var top = Math.max(8, Math.min(window.innerHeight - 218, hover.rect.top - 12));
				var stamp = formatTime(hover.item.time);
				var meta = "输入 #" + (hover.index + 1) + (stamp ? " · " + stamp : "");
				preview = h("aside", {
					id: "dsh-reach-point-preview",
					role: "tooltip",
					className: "dsh-reach-point-preview",
					style: { left: left + "px", top: top + "px" },
				},
					h("div", { className: "dsh-reach-point-preview-title" }, parts.title),
					parts.detail ? h("div", { className: "dsh-reach-point-preview-body" }, parts.detail) : null,
					h("div", { className: "dsh-reach-point-preview-meta" }, h("span", { className: "dsh-reach-point-preview-dot", "aria-hidden": "true" }), meta),
				);
			}

			return h("nav", {
				ref: railRef,
				className: "dsh-reach-point-rail",
				"data-rp-theme": theme,
				"aria-label": "对话输入导航",
				tabIndex: 0,
				onKeyDown: onKeyDown,
			}, ticks, preview);
		}

		function apply(ctx) {
			ctx.effect(function () {
				var style = document.createElement("style");
				style.setAttribute("data-dsh-reach-point-style", "");
				style.textContent = CSS_TEXT;
				document.head.appendChild(style);
				var source = makeSessionIdSource(ctx);
				var offSlot = ctx.slots.register({
					name: "shell.overlay",
					id: "dsh-reach-point-rail",
					inject: function () { return { hooks: { sessionId: source } }; },
				}, ReachPointRail);
				return function () {
					offSlot();
					source.dispose();
					if (style.isConnected) style.remove();
				};
			}, "dsh-reach-point: overlay registration");
		}

		exports.apply = apply;
		exports.inject = ["sessions", "slots"];
		return module.exports;
	},
});
