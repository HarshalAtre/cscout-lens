import * as vscode from 'vscode';

export interface GraphNode {
    id: string;
    label: string;
    type: 'function' | 'file' | 'identifier';
}

export interface GraphEdge {
    source: string;
    target: string;
    label?: string;
}

export interface GraphData {
    nodes: GraphNode[];
    edges: GraphEdge[];
    title: string;
}

export function createGraphPanel(context: vscode.ExtensionContext, data: GraphData): vscode.WebviewPanel {
    const panel = vscode.window.createWebviewPanel(
        'cscoutGraph',
        data.title,
        vscode.ViewColumn.Two,
        { enableScripts: true }
    );

    panel.webview.html = getGraphHtml(data);
    return panel;
}

function getGraphHtml(data: GraphData): string {
    const nodesJson = JSON.stringify(data.nodes);
    const edgesJson = JSON.stringify(data.edges);

    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${data.title}</title>
    <style>
        body { margin: 0; padding: 0; overflow: hidden; font-family: var(--vscode-font-family); background: var(--vscode-editor-background); }
        #graph { width: 100vw; height: 100vh; }
        .node { cursor: pointer; }
        .node rect { fill: var(--vscode-button-background); stroke: var(--vscode-button-border); stroke-width: 2px; rx: 5; }
        .node text { fill: var(--vscode-button-foreground); font-size: 12px; }
        .node:hover rect { fill: var(--vscode-button-hoverBackground); }
        .edge { stroke: var(--vscode-editorLineNumber-foreground); stroke-width: 2px; fill: none; marker-end: url(#arrowhead); }
        .edge-label { fill: var(--vscode-descriptionForeground); font-size: 10px; }
        .controls { position: fixed; top: 10px; right: 10px; display: flex; gap: 5px; }
        .controls button { padding: 5px 10px; background: var(--vscode-button-background); color: var(--vscode-button-foreground);
            border: none; cursor: pointer; border-radius: 3px; }
        .controls button:hover { background: var(--vscode-button-hoverBackground); }
    </style>
</head>
<body>
    <div class="controls">
        <button onclick="zoomIn()">+</button>
        <button onclick="zoomOut()">-</button>
        <button onclick="resetZoom()">Reset</button>
    </div>
    <svg id="graph"></svg>
    <script>
        const nodes = ${nodesJson};
        const edges = ${edgesJson};
        
        const svg = document.getElementById('graph');
        const width = window.innerWidth;
        const height = window.innerHeight;
        svg.setAttribute('viewBox', \`0 0 \${width} \${height}\`);
        
        let scale = 1;
        let translateX = 0, translateY = 0;
        
        // Simple force-directed layout
        const nodeWidth = 120, nodeHeight = 30;
        const nodeMap = new Map();
        
        nodes.forEach((node, i) => {
            const angle = (2 * Math.PI * i) / nodes.length;
            const radius = Math.min(width, height) / 3;
            node.x = width / 2 + radius * Math.cos(angle);
            node.y = height / 2 + radius * Math.sin(angle);
            nodeMap.set(node.id, node);
        });
        
        function render() {
            svg.innerHTML = '';
            
            // Add arrowhead marker definition
            const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
            const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
            marker.setAttribute('id', 'arrowhead');
            marker.setAttribute('markerWidth', '10');
            marker.setAttribute('markerHeight', '10');
            marker.setAttribute('refX', '9');
            marker.setAttribute('refY', '3');
            marker.setAttribute('orient', 'auto');
            marker.setAttribute('markerUnits', 'strokeWidth');
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', 'M0,0 L0,6 L9,3 z');
            path.setAttribute('fill', 'var(--vscode-editorLineNumber-foreground)');
            marker.appendChild(path);
            defs.appendChild(marker);
            svg.appendChild(defs);
            
            // Draw edges with arrows
            edges.forEach(edge => {
                const source = nodeMap.get(edge.source);
                const target = nodeMap.get(edge.target);
                if (source && target) {
                    // Calculate edge endpoints to stop at node boundaries
                    const dx = target.x - source.x;
                    const dy = target.y - source.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance > 0) {
                        const sourceX = source.x + nodeWidth / 2 + (dx / distance) * (nodeWidth / 2);
                        const sourceY = source.y + nodeHeight / 2 + (dy / distance) * (nodeHeight / 2);
                        const targetX = target.x + nodeWidth / 2 - (dx / distance) * (nodeWidth / 2 + 10);
                        const targetY = target.y + nodeHeight / 2 - (dy / distance) * (nodeHeight / 2 + 10);
                        
                        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                        line.setAttribute('class', 'edge');
                        line.setAttribute('x1', sourceX);
                        line.setAttribute('y1', sourceY);
                        line.setAttribute('x2', targetX);
                        line.setAttribute('y2', targetY);
                        svg.appendChild(line);
                    }
                }
            });
            
            // Draw nodes
            nodes.forEach(node => {
                const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                g.setAttribute('class', 'node');
                g.setAttribute('transform', \`translate(\${node.x}, \${node.y})\`);
                
                const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                rect.setAttribute('width', nodeWidth);
                rect.setAttribute('height', nodeHeight);
                g.appendChild(rect);
                
                const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                text.setAttribute('x', nodeWidth / 2);
                text.setAttribute('y', nodeHeight / 2 + 4);
                text.setAttribute('text-anchor', 'middle');
                text.textContent = node.label.length > 14 ? node.label.slice(0, 12) + '...' : node.label;
                g.appendChild(text);
                
                svg.appendChild(g);
            });
        }
        
        function zoomIn() { scale *= 1.2; updateTransform(); }
        function zoomOut() { scale /= 1.2; updateTransform(); }
        function resetZoom() { scale = 1; translateX = 0; translateY = 0; updateTransform(); }
        
        function updateTransform() {
            svg.style.transform = \`scale(\${scale}) translate(\${translateX}px, \${translateY}px)\`;
        }
        
        // Pan with mouse drag
        let isDragging = false, lastX, lastY;
        svg.addEventListener('mousedown', e => { isDragging = true; lastX = e.clientX; lastY = e.clientY; });
        svg.addEventListener('mousemove', e => {
            if (isDragging) {
                translateX += (e.clientX - lastX) / scale;
                translateY += (e.clientY - lastY) / scale;
                lastX = e.clientX; lastY = e.clientY;
                updateTransform();
            }
        });
        svg.addEventListener('mouseup', () => isDragging = false);
        svg.addEventListener('mouseleave', () => isDragging = false);
        
        render();
    </script>
</body>
</html>`;
}
