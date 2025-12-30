
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
        <div ref={containerRef} className="w-full h-[250px] overflow-hidden bg-background mb-8 rounded-lg border border-border/50 relative">
            <svg width={dimensions.width} height={dimensions.height} className="absolute top-0 left-0">
                <defs>
                    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="20" refY="3.5" orient="auto">
                        <polygon points="0 0, 10 3.5, 0 7" fill={strokeColor} opacity="0.5" />
                    </marker>
                </defs>
                <g>
                    {links.map((link, i) => (
                        <line
                            key={i}
                            x1={link.source.x}
                            y1={link.source.y}
                            x2={link.target.x}
                            y2={link.target.y}
                            stroke={strokeColor}
                            strokeWidth={1}
                            opacity={0.4}
                        />
                    ))}
                    {nodes.map((node) => (
                        <g
                            key={node.id}
                            onClick={() => handleNodeClick(node)}
                            onMouseEnter={() => setHoveredNodeId(node.id)}
                            onMouseLeave={() => setHoveredNodeId(null)}
                            style={{ cursor: node.id === 'root-virtual' ? 'default' : 'pointer' }}
                            className="transition-all duration-300 ease-in-out"
                        >
                            <circle
                                cx={node.x}
                                cy={node.y}
                                r={node.radius + (hoveredNodeId === node.id ? 2 : 0)}
                                fill={isDark ? '#000' : '#fff'}
                                stroke={noceColor}
                                strokeWidth={node.id === 'root-virtual' ? 3 : 1}
                                className="transition-all duration-300"
                            />
                            {/* Show text for root or hovered nodes */}
                            {(node.id === 'root-virtual' || hoveredNodeId === node.id) && (
                                <text
                                    x={node.x}
                                    y={node.y - node.radius - 5}
                                    textAnchor="middle"
                                    fill={textColor}
                                    fontSize={node.id === 'root-virtual' ? "14" : "10"}
                                    fontWeight={node.id === 'root-virtual' ? "bold" : "normal"}
                                    className="select-none pointer-events-none"
                                >
                                    {node.id === 'root-virtual' ? "Hello Nostr World" : node.post?.content.substring(0, 20) + (node.post?.content.length > 20 ? '...' : '')}
                                </text>
                            )}
                        </g>
                    ))}
                </g>
            </svg>
        </div>
    );
};

export default NostrVisualization;
