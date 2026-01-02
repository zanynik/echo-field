
import { useEffect, useRef, useState } from 'react';
import { NostrPost } from "@/lib/nostr";

interface NostrVisualizationProps {
    posts: NostrPost[];
    theme: 'dark' | 'light' | 'system';
    onNodeClick?: (postId: string) => void;
}

interface Node {
    id: string;
    x: number;
    y: number;
    radius: number;
    label?: string;
    post?: NostrPost;
    level: number;
    angle?: number;
}

interface Link {
    source: Node;
    target: Node;
}

const NostrVisualization = ({ posts, theme, onNodeClick }: NostrVisualizationProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [nodes, setNodes] = useState<Node[]>([]);
    const [links, setLinks] = useState<Link[]>([]);
    const [dimensions, setDimensions] = useState({ width: 800, height: 300 });
    const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

    // Pan and Zoom state
    const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;
        setTransform(prev => ({
            ...prev,
            x: e.clientX - dragStart.x,
            y: e.clientY - dragStart.y
        }));
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const handleWheel = (e: React.WheelEvent) => {
        const scaleBy = 1.1;
        const oldScale = transform.scale;
        const newScale = e.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;

        // Limit scale
        if (newScale < 0.1 || newScale > 5) return;

        // Zoom towards center (simplification)
        // Ideally should zoom towards mouse pointer but centered setTransform is easier to start with

        setTransform(prev => ({ ...prev, scale: newScale }));
    };

    useEffect(() => {
        const updateDimensions = () => {
            if (containerRef.current) {
                setDimensions({
                    width: containerRef.current.clientWidth,
                    height: 250 // Fixed height for consistency
                });
            }
        };

        window.addEventListener('resize', updateDimensions);
        updateDimensions();

        return () => window.removeEventListener('resize', updateDimensions);
    }, []);

    useEffect(() => {
        if (!posts.length) return;

        // Process posts into a radial structure
        // Virtual Root -> Level 1 Post (Root of thread) -> Level 2 Post (Reply) ...

        const centerX = dimensions.width / 2;
        const centerY = dimensions.height / 2;

        let rootNode: Node;
        let startLevelNodes: NostrPost[];
        let isVirtualRoot = false;

        // If we have exactly one root post, use it as the center
        if (posts.length === 1) {
            const realRoot = posts[0];
            rootNode = {
                id: realRoot.id,
                x: centerX,
                y: centerY,
                radius: 20,
                // Label with truncate
                label: realRoot.content.length > 20 ? realRoot.content.substring(0, 20) + '...' : realRoot.content,
                post: realRoot,
                level: 0
            };
            startLevelNodes = realRoot.comments || [];
        }

        const newNodes: Node[] = [rootNode];
        const newLinks: Link[] = [];

        const totalStartNodes = startLevelNodes.length;

        // If the root has no comments/posts to show
        if (totalStartNodes === 0 && !isVirtualRoot) {
            setNodes(newNodes);
            setLinks(newLinks);
            return;
        }

        // Level 1 Ring
        const level1Radius = Math.min(dimensions.width, dimensions.height) * 0.25;

        startLevelNodes.forEach((post, index) => {
            const angle = (index / totalStartNodes) * 2 * Math.PI;
            const x = centerX + level1Radius * Math.cos(angle);
            const y = centerY + level1Radius * Math.sin(angle);

            const postNode: Node = {
                id: post.id,
                x,
                y,
                radius: 12, // Slightly larger
                post: post,
                label: '', // No label for level 1 to reduce clutter? Or keep it?
                level: 1,
                angle
            };

            newNodes.push(postNode);
            newLinks.push({ source: rootNode, target: postNode });

            // Level 2: Comments on these nodes
            if (post.comments && post.comments.length > 0) {
                const level2Radius = 70; // Distance from parent
                const startAngle = angle - Math.PI / 4;
                const totalSpread = Math.PI / 2;

                post.comments.forEach((comment, cIndex) => {
                    const l2X = x + level2Radius * Math.cos(angle + (cIndex - post.comments.length / 2) * 0.3);
                    const l2Y = y + level2Radius * Math.sin(angle + (cIndex - post.comments.length / 2) * 0.3);

                    const commentNode: Node = {
                        id: comment.id,
                        x: l2X,
                        y: l2Y,
                        radius: 8,
                        post: comment,
                        level: 2
                    };
                    newNodes.push(commentNode);
                    newLinks.push({ source: postNode, target: commentNode });
                });
            }
        });

        setNodes(newNodes);
        setLinks(newLinks);

    }, [posts, dimensions]);

    const handleNodeClick = (node: Node) => {
        if (node.id === 'root-virtual') return;
        if (onNodeClick) {
            onNodeClick(node.id);
        } else {
            // Fallback default behavior
            const element = document.getElementById(node.id);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                element.classList.add('highlight-flash');
                setTimeout(() => element.classList.remove('highlight-flash'), 2000);
            }
        }
    };

    const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    const strokeColor = isDark ? '#333' : '#ddd';
    const noceColor = isDark ? '#fff' : '#000';
    const textColor = isDark ? '#fff' : '#000';

    return (
        <div ref={containerRef} className="w-full h-[250px] overflow-hidden bg-background mb-8 rounded-lg border border-border/50 relative select-none">
            <svg
                width={dimensions.width}
                height={dimensions.height}
                className="absolute top-0 left-0 cursor-move"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
            >
                <defs>
                    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="20" refY="3.5" orient="auto">
                        <polygon points="0 0, 10 3.5, 0 7" fill={strokeColor} opacity="0.5" />
                    </marker>
                </defs>
                <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
                    {links.map((link, i) => (
                        <line
                            key={i}
                            x1={link.source.x}
                            y1={link.source.y}
                            x2={link.target.x}
                            y2={link.target.y}
                            stroke={strokeColor}
                            strokeWidth={1 / transform.scale}
                            opacity={0.4}
                        />
                    ))}
                    {nodes.map((node) => (
                        <g
                            key={node.id}
                            onClick={(e) => {
                                e.stopPropagation(); // Prevent drag start
                                if (!isDragging) handleNodeClick(node);
                            }}
                            onMouseEnter={() => setHoveredNodeId(node.id)}
                            onMouseLeave={() => setHoveredNodeId(null)}
                            style={{ cursor: node.id === 'root-virtual' ? 'default' : 'pointer' }}
                            className="transition-opacity duration-300 ease-in-out"
                        >
                            <circle
                                cx={node.x}
                                cy={node.y}
                                r={node.radius + (hoveredNodeId === node.id ? 2 : 0)}
                                fill={isDark ? '#000' : '#fff'}
                                stroke={noceColor}
                                strokeWidth={(node.id === 'root-virtual' ? 3 : 1) / transform.scale}
                            />
                            {/* Show text for root or hovered nodes */}
                            {(node.id === 'root-virtual' || hoveredNodeId === node.id) && (
                                <text
                                    x={node.x}
                                    y={node.y - node.radius - 5 / transform.scale}
                                    textAnchor="middle"
                                    fill={textColor}
                                    fontSize={(node.id === 'root-virtual' ? 14 : 10) / transform.scale}
                                    fontWeight={node.id === 'root-virtual' ? "bold" : "normal"}
                                    className="select-none pointer-events-none"
                                >
                                    {node.id === 'root-virtual' ? "Hello Nostr World" : (
                                        node.post?.authorName ? `${node.post.authorName}: ${node.post.content.substring(0, 15)}...` :
                                            node.post?.content.substring(0, 20) + (node.post?.content.length > 20 ? '...' : '')
                                    )}
                                </text>
                            )}
                        </g>
                    ))}
                </g>
            </svg>

            <div className="absolute bottom-2 right-2 flex flex-col gap-1">
                <button
                    className="bg-background/80 hover:bg-muted p-1 rounded border shadow-sm"
                    onClick={(e) => { e.stopPropagation(); setTransform(prev => ({ ...prev, scale: prev.scale * 1.2 })); }}
                >
                    +
                </button>
                <button
                    className="bg-background/80 hover:bg-muted p-1 rounded border shadow-sm"
                    onClick={(e) => { e.stopPropagation(); setTransform(prev => ({ ...prev, scale: prev.scale / 1.2 })); }}
                >
                    -
                </button>
                <button
                    className="bg-background/80 hover:bg-muted p-1 rounded border shadow-sm text-xs"
                    onClick={(e) => { e.stopPropagation(); setTransform({ x: 0, y: 0, scale: 1 }); }}
                >
                    R
                </button>
            </div>
        </div>
    );
};

export default NostrVisualization;
