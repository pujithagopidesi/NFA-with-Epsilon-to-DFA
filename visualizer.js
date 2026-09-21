/**
 * visualizer.js - Interactive SVG Automata Graph Visualizer
 * Fully supports:
 * - Dynamic node sizing based on label length ([q0], [q0, q1, q2]) so labels never overflow
 * - Exact boundary arrow attachment for straight, curved, and self-loop transitions
 * - Start arrow indicator and concentric double circles for final states
 * - Interactive dragging, canvas zoom & pan, auto-rearrange, and SVG export
 */

class AutomataVisualizer {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error(`Container #${containerId} not found`);
            return;
        }

        this.options = Object.assign({
            nodeRadius: 28,
            isInteractive: true,
            theme: 'dark',
            onNodeClick: null,
            onCanvasClick: null
        }, options);

        this.nodes = new Map(); // id -> { id, label, x, y, isStart, isFinal, subtitle, radius }
        this.edges = [];        // [{ from, to, symbols: [] }]
        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;
        this.draggedNode = null;
        this.isPanning = false;
        this.panStart = { x: 0, y: 0 };
        this.activeStates = new Set();

        this.initSVG();
        this.bindEvents();
    }

    initSVG() {
        this.container.innerHTML = '';
        this.container.style.position = 'relative';
        this.container.style.overflow = 'hidden';

        // Create main SVG element
        this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        this.svg.setAttribute('width', '100%');
        this.svg.setAttribute('height', '100%');
        this.svg.setAttribute('class', 'automata-svg');

        // Create defs for arrowheads and filters
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        defs.innerHTML = `
            <!-- Arrow marker standard -->
            <marker id="arrowhead-${this.container.id}" viewBox="0 0 10 10" refX="10" refY="5"
                    markerWidth="8" markerHeight="8" orient="auto">
                <path d="M 0 1.5 L 10 5 L 0 8.5 z" class="arrow-marker" />
            </marker>
            <!-- Arrow marker highlighted -->
            <marker id="arrowhead-active-${this.container.id}" viewBox="0 0 10 10" refX="10" refY="5"
                    markerWidth="9" markerHeight="9" orient="auto">
                <path d="M 0 1.5 L 10 5 L 0 8.5 z" class="arrow-marker-active" />
            </marker>
            <!-- Start arrow marker -->
            <marker id="arrowhead-start-${this.container.id}" viewBox="0 0 10 10" refX="10" refY="5"
                    markerWidth="7" markerHeight="7" orient="auto">
                <path d="M 0 2 L 10 5 L 0 8 z" class="start-arrow-marker" />
            </marker>
            <!-- Glow filter for active states -->
            <filter id="glow-${this.container.id}" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                </feMerge>
            </filter>
        `;
        this.svg.appendChild(defs);

        // Transform group for zooming and panning
        this.transformGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        this.transformGroup.setAttribute('class', 'pan-zoom-group');
        this.svg.appendChild(this.transformGroup);

        // Layer groups
        this.edgeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        this.edgeGroup.setAttribute('class', 'edges-layer');
        this.transformGroup.appendChild(this.edgeGroup);

        this.nodeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        this.nodeGroup.setAttribute('class', 'nodes-layer');
        this.transformGroup.appendChild(this.nodeGroup);

        this.container.appendChild(this.svg);

        this.createToolbar();
    }

    createToolbar() {
        const toolbar = document.createElement('div');
        toolbar.className = 'canvas-toolbar';
        toolbar.innerHTML = `
            <button class="tool-btn" data-action="zoom-in" title="Zoom In">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
            </button>
            <button class="tool-btn" data-action="zoom-out" title="Zoom Out">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
            </button>
            <button class="tool-btn" data-action="fit" title="Fit to View">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
            </button>
            <button class="tool-btn" data-action="rearrange" title="Auto Rearrange States">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
            </button>
            <button class="tool-btn" data-action="export-svg" title="Export as SVG">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </button>
        `;
        this.container.appendChild(toolbar);

        toolbar.addEventListener('click', (e) => {
            const btn = e.target.closest('.tool-btn');
            if (!btn) return;
            const action = btn.dataset.action;
            if (action === 'zoom-in') this.zoomAt(1.2);
            else if (action === 'zoom-out') this.zoomAt(0.8);
            else if (action === 'fit') this.fitToView();
            else if (action === 'rearrange') this.autoLayout();
            else if (action === 'export-svg') this.exportSVG();
        });
    }

    bindEvents() {
        const svg = this.svg;

        // Dragging & Panning
        svg.addEventListener('mousedown', (e) => {
            const nodeEl = e.target.closest('.automata-node');
            if (nodeEl && this.options.isInteractive) {
                const nodeId = nodeEl.dataset.id;
                this.draggedNode = this.nodes.get(nodeId);
                this.dragStartMouse = { x: e.clientX, y: e.clientY };
                this.dragStartNode = { x: this.draggedNode.x, y: this.draggedNode.y };
                e.stopPropagation();
            } else if (e.target === svg || e.target.closest('.pan-zoom-group')) {
                this.isPanning = true;
                this.panStart = { x: e.clientX - this.panX, y: e.clientY - this.panY };
            }
        });

        window.addEventListener('mousemove', (e) => {
            if (this.draggedNode) {
                const dx = (e.clientX - this.dragStartMouse.x) / this.zoom;
                const dy = (e.clientY - this.dragStartMouse.y) / this.zoom;
                this.draggedNode.x = this.dragStartNode.x + dx;
                this.draggedNode.y = this.dragStartNode.y + dy;
                this.render();
            } else if (this.isPanning) {
                this.panX = e.clientX - this.panStart.x;
                this.panY = e.clientY - this.panStart.y;
                this.updateTransform();
            }
        });

        window.addEventListener('mouseup', () => {
            this.draggedNode = null;
            this.isPanning = false;
        });

        svg.addEventListener('wheel', (e) => {
            e.preventDefault();
            const rect = svg.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
            this.zoomAt(zoomFactor, mouseX, mouseY);
        });

        if (window.ResizeObserver) {
            new ResizeObserver(() => {
                if (this.nodes.size > 0 && this.panX === 0 && this.panY === 0) {
                    this.fitToView();
                }
            }).observe(this.container);
        }
    }

    zoomAt(factor, clientX, clientY) {
        const prevZoom = this.zoom;
        const newZoom = Math.min(Math.max(0.3, prevZoom * factor), 3.0);

        if (clientX === undefined || clientY === undefined) {
            const rect = this.container.getBoundingClientRect();
            clientX = rect.width / 2;
            clientY = rect.height / 2;
        }

        this.panX = clientX - (clientX - this.panX) * (newZoom / prevZoom);
        this.panY = clientY - (clientY - this.panY) * (newZoom / prevZoom);
        this.zoom = newZoom;
        this.updateTransform();
    }

    updateTransform() {
        this.transformGroup.setAttribute('transform', `translate(${this.panX}, ${this.panY}) scale(${this.zoom})`);
    }

    /**
     * Calculates dynamic node radius based on label length
     * Prevents text overflow for subset labels like [q0, q1, q2]
     */
    getNodeRadius(node) {
        if (!node) return 28;
        const textLen = (node.label || '').length;
        // Standard single state (q0, q1): r = 28
        // DFA subset ([q0, q1]): r = ~44
        // DFA triple ([q0, q1, q2]): r = ~62
        return Math.max(28, Math.ceil(textLen * 4.4 + 10));
    }

    /**
     * Set graph data and layout
     */
    setData(nodes, transitions, startState, finalStates) {
        this.nodes.clear();
        this.edges = [];
        this.activeStates.clear();

        const count = nodes.length;
        const width = this.container.clientWidth || 600;
        const height = this.container.clientHeight || 450;
        const centerX = width / 2;
        const centerY = height / 2;

        // Calculate layout radius considering node sizes
        let maxExpectedRadius = 28;
        nodes.forEach(node => {
            const label = typeof node === 'string' ? node : (node.label || node.id);
            const r = Math.max(28, Math.ceil(label.length * 4.4 + 10));
            if (r > maxExpectedRadius) maxExpectedRadius = r;
        });

        const circumferenceNeeded = count * (maxExpectedRadius * 2 + 45);
        const minLayoutRadius = count > 1 ? Math.max(140, circumferenceNeeded / (2 * Math.PI)) : 0;
        const layoutRadius = Math.max(minLayoutRadius, Math.min(width, height) * 0.35);

        nodes.forEach((node, index) => {
            const id = typeof node === 'string' ? node : node.id;
            const label = typeof node === 'string' ? node : (node.label || node.id);
            const subtitle = typeof node === 'object' ? node.subtitle : '';

            let x = centerX;
            let y = centerY;
            if (count > 1) {
                const angle = (index / count) * 2 * Math.PI - Math.PI / 2;
                x = centerX + layoutRadius * Math.cos(angle);
                y = centerY + layoutRadius * Math.sin(angle);
            }

            const isStart = id === startState;
            const isFinal = finalStates ? (finalStates.has ? finalStates.has(id) : finalStates.includes(id)) : false;

            this.nodes.set(id, {
                id: id,
                label: label,
                subtitle: subtitle,
                x: x,
                y: y,
                isStart: isStart,
                isFinal: isFinal
            });
        });

        // 2. Aggregate transitions: merge symbols for same (from, to) pairs
        const edgeMap = new Map();

        if (Array.isArray(transitions)) {
            transitions.forEach(t => {
                if (t.from && t.to) {
                    const key = `${t.from}|||${t.to}`;
                    if (!edgeMap.has(key)) edgeMap.set(key, new Set());
                    edgeMap.get(key).add(t.symbol);
                }
            });
        } else if (typeof transitions === 'object') {
            for (const from in transitions) {
                for (const symbol in transitions[from]) {
                    const toVal = transitions[from][symbol];
                    if (toVal instanceof Set || Array.isArray(toVal)) {
                        toVal.forEach(to => {
                            if (to) {
                                const key = `${from}|||${to}`;
                                if (!edgeMap.has(key)) edgeMap.set(key, new Set());
                                edgeMap.get(key).add(symbol);
                            }
                        });
                    } else if (toVal) {
                        const key = `${from}|||${toVal}`;
                        if (!edgeMap.has(key)) edgeMap.set(key, new Set());
                        edgeMap.get(key).add(symbol);
                    }
                }
            }
        }

        edgeMap.forEach((symbols, key) => {
            const [from, to] = key.split('|||');
            if (this.nodes.has(from) && this.nodes.has(to)) {
                this.edges.push({
                    from: from,
                    to: to,
                    symbols: Array.from(symbols).sort()
                });
            }
        });

        this.fitToView();
        this.render();
    }

    autoLayout() {
        const count = this.nodes.size;
        if (count === 0) return;

        const width = this.container.clientWidth || 600;
        const height = this.container.clientHeight || 450;
        const centerX = width / 2;
        const centerY = height / 2;

        let maxExpectedRadius = 28;
        this.nodes.forEach(node => {
            const r = this.getNodeRadius(node);
            if (r > maxExpectedRadius) maxExpectedRadius = r;
        });

        const circumferenceNeeded = count * (maxExpectedRadius * 2 + 45);
        const minLayoutRadius = count > 1 ? Math.max(140, circumferenceNeeded / (2 * Math.PI)) : 0;
        const layoutRadius = Math.max(minLayoutRadius, Math.min(width, height) * 0.35);

        let i = 0;
        this.nodes.forEach(node => {
            if (count === 1) {
                node.x = centerX;
                node.y = centerY;
            } else {
                const angle = (i / count) * 2 * Math.PI - Math.PI / 2;
                node.x = centerX + layoutRadius * Math.cos(angle);
                node.y = centerY + layoutRadius * Math.sin(angle);
            }
            i++;
        });

        this.fitToView();
        this.render();
    }

    fitToView() {
        if (this.nodes.size === 0) return;

        const containerW = this.container.clientWidth || 600;
        const containerH = this.container.clientHeight || 450;

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        this.nodes.forEach(n => {
            const r = this.getNodeRadius(n);
            minX = Math.min(minX, n.x - r);
            maxX = Math.max(maxX, n.x + r);
            minY = Math.min(minY, n.y - r);
            maxY = Math.max(maxY, n.y + r);
        });

        const padding = 75;
        const graphW = Math.max(maxX - minX + padding * 2, 220);
        const graphH = Math.max(maxY - minY + padding * 2, 220);

        const scaleX = containerW / graphW;
        const scaleY = containerH / graphH;
        this.zoom = Math.min(Math.max(Math.min(scaleX, scaleY), 0.4), 1.25);

        const graphCenterX = (minX + maxX) / 2;
        const graphCenterY = (minY + maxY) / 2;
        this.panX = containerW / 2 - graphCenterX * this.zoom;
        this.panY = containerH / 2 - graphCenterY * this.zoom;

        this.updateTransform();
    }

    setActiveStates(stateIds) {
        this.activeStates = new Set(Array.isArray(stateIds) ? stateIds : [stateIds]);
        this.render();
    }

    render() {
        this.edgeGroup.innerHTML = '';
        this.nodeGroup.innerHTML = '';

        // Render Edges
        this.edges.forEach(edge => {
            const fromNode = this.nodes.get(edge.from);
            const toNode = this.nodes.get(edge.to);
            if (!fromNode || !toNode) return;

            const fromR = this.getNodeRadius(fromNode);
            const toR = this.getNodeRadius(toNode);

            const isSelf = edge.from === edge.to;
            const hasReverse = this.edges.some(e => e.from === edge.to && e.to === edge.from && e.from !== e.to);
            const isHighlighted = this.activeStates.has(edge.from);
            const labelText = edge.symbols.join(', ');

            if (isSelf) {
                // Self-loop: quadratic/cubic bezier arc above node
                const startX = fromNode.x - 14;
                const startY = fromNode.y - fromR + 3;
                const endX = fromNode.x + 14;
                const endY = fromNode.y - fromR + 3;
                const loopHeight = Math.max(34, fromR * 0.85);
                const peakY = fromNode.y - fromR - loopHeight;

                const pathData = `M ${startX} ${startY} C ${startX - 20} ${peakY}, ${endX + 20} ${peakY}, ${endX} ${endY}`;

                const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                pathEl.setAttribute('d', pathData);
                pathEl.setAttribute('class', `automata-edge ${isHighlighted ? 'edge-active' : ''}`);
                pathEl.setAttribute('marker-end', `url(#arrowhead-${isHighlighted ? 'active-' : ''}${this.container.id})`);
                this.edgeGroup.appendChild(pathEl);

                this.renderEdgeLabel(fromNode.x, peakY + 2, labelText);
            } else {
                // Directed edge between two distinct nodes
                const dx = toNode.x - fromNode.x;
                const dy = toNode.y - fromNode.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist === 0) return;

                const ux = dx / dist;
                const uy = dy / dist;
                const px = -uy;
                const py = ux;

                const curvature = hasReverse ? 30 : 0;
                const midX = (fromNode.x + toNode.x) / 2 + px * curvature;
                const midY = (fromNode.y + toNode.y) / 2 + py * curvature;

                let startPoint, endPoint;
                if (hasReverse) {
                    const distMidFrom = Math.hypot(midX - fromNode.x, midY - fromNode.y);
                    const distMidTo = Math.hypot(toNode.x - midX, toNode.y - midY);

                    startPoint = {
                        x: fromNode.x + (midX - fromNode.x) * (fromR / distMidFrom),
                        y: fromNode.y + (midY - fromNode.y) * (fromR / distMidFrom)
                    };
                    endPoint = {
                        x: toNode.x - (toNode.x - midX) * ((toR + 2) / distMidTo),
                        y: toNode.y - (toNode.y - midY) * ((toR + 2) / distMidTo)
                    };
                } else {
                    startPoint = {
                        x: fromNode.x + ux * fromR,
                        y: fromNode.y + uy * fromR
                    };
                    endPoint = {
                        x: toNode.x - ux * (toR + 2),
                        y: toNode.y - uy * (toR + 2)
                    };
                }

                const pathData = hasReverse
                    ? `M ${startPoint.x} ${startPoint.y} Q ${midX} ${midY} ${endPoint.x} ${endPoint.y}`
                    : `M ${startPoint.x} ${startPoint.y} L ${endPoint.x} ${endPoint.y}`;

                const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                pathEl.setAttribute('d', pathData);
                pathEl.setAttribute('class', `automata-edge ${isHighlighted ? 'edge-active' : ''}`);
                pathEl.setAttribute('marker-end', `url(#arrowhead-${isHighlighted ? 'active-' : ''}${this.container.id})`);
                this.edgeGroup.appendChild(pathEl);

                const labelX = hasReverse ? midX : (startPoint.x + endPoint.x) / 2 + px * 12;
                const labelY = hasReverse ? midY : (startPoint.y + endPoint.y) / 2 + py * 12;
                this.renderEdgeLabel(labelX, labelY, labelText);
            }
        });

        // Render Nodes (States)
        this.nodes.forEach(node => {
            const r = this.getNodeRadius(node);

            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            g.setAttribute('class', `automata-node ${this.activeStates.has(node.id) ? 'node-active' : ''}`);
            g.setAttribute('data-id', node.id);
            g.setAttribute('transform', `translate(${node.x}, ${node.y})`);

            // Start State Indicator: Arrow pointing to the node from the left
            if (node.isStart) {
                const startLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                startLine.setAttribute('x1', -r - 35);
                startLine.setAttribute('y1', 0);
                startLine.setAttribute('x2', -r - 4);
                startLine.setAttribute('y2', 0);
                startLine.setAttribute('class', 'start-arrow-line');
                startLine.setAttribute('marker-end', `url(#arrowhead-start-${this.container.id})`);
                g.appendChild(startLine);

                const startText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                startText.setAttribute('x', -r - 38);
                startText.setAttribute('y', -6);
                startText.setAttribute('class', 'start-text');
                startText.textContent = 'start';
                g.appendChild(startText);
            }

            // Outer Circle (Curved circle)
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('r', r);
            circle.setAttribute('class', 'state-circle');
            if (this.activeStates.has(node.id)) {
                circle.setAttribute('filter', `url(#glow-${this.container.id})`);
            }
            g.appendChild(circle);

            // Double Circle for Final/Accepting States
            if (node.isFinal) {
                const innerCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                innerCircle.setAttribute('r', r - 5.5);
                innerCircle.setAttribute('class', 'state-inner-circle');
                g.appendChild(innerCircle);
            }

            // State Label (Monospace, bold, centered)
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('y', 4.5);
            text.setAttribute('class', 'state-label');
            text.textContent = node.label;
            g.appendChild(text);

            g.addEventListener('click', () => {
                if (this.options.onNodeClick) {
                    this.options.onNodeClick(node.id, node);
                }
            });

            this.nodeGroup.appendChild(g);
        });
    }

    renderEdgeLabel(x, y, text) {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('class', 'edge-label-group');
        g.setAttribute('transform', `translate(${x}, ${y})`);

        const paddingH = 6;
        const width = Math.max(text.length * 8 + paddingH * 2, 22);
        const height = 18;

        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', -width / 2);
        rect.setAttribute('y', -height / 2);
        rect.setAttribute('width', width);
        rect.setAttribute('height', height);
        rect.setAttribute('rx', 4);
        rect.setAttribute('class', 'edge-label-bg');
        g.appendChild(rect);

        const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textEl.setAttribute('y', 4);
        textEl.setAttribute('class', 'edge-label-text');
        textEl.textContent = text;
        g.appendChild(textEl);

        this.edgeGroup.appendChild(g);
    }

    exportSVG() {
        const serializer = new XMLSerializer();
        let source = serializer.serializeToString(this.svg);
        if (!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
            source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
        }
        const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = `automata-${this.container.id}.svg`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(url);
    }
}

window.AutomataVisualizer = AutomataVisualizer;
