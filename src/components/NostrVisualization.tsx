
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
    const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
    const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

    useEffect(() => {
        const updateDimensions = () => {
            if (containerRef.current) {
                setDimensions({
                    width: containerRef.current.clientWidth,
                    height: 500 // Fixed height for consistency
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

        const rootNode: Node = {
            id: 'root-virtual',
            x: centerX,
            y: centerY,
            radius: 40,
            label: 'Hello Nostr World',
            level: 0
        };

        const newNodes: Node[] = [rootNode];
        const newLinks: Link[] = [];

        // Filter for top-level posts (those that don't satisfy parent_id check within the fetched set is tricky, 
        // relying on the passed hierarchical structure is safer if available, but here we got flat list usually?
        // Actually, the index passes hierarchical posts. Let's traverse them.)

        // Wait, index passes hierarchical posts! So `posts` are the roots.

        const totalRoots = posts.length;
        if (totalRoots === 0) return;

        // Level 1: The actual posts shown in the list
        // Distribute them in a circle around the center
        const level1Radius = Math.min(dimensions.width, dimensions.height) * 0.25;

        posts.forEach((post, index) => {
            const angle = (index / totalRoots) * 2 * Math.PI;
            const x = centerX + level1Radius * Math.cos(angle);
            const y = centerY + level1Radius * Math.sin(angle);

            const postNode: Node = {
                id: post.id,
                x,
                y,
                radius: 10,
                post: post,
                label: post.content.substring(0, 10) + '...',
                level: 1,
                angle
            };

            newNodes.push(postNode);
            newLinks.push({ source: rootNode, target: postNode });

            // Level 2: Comments on these posts
            if (post.comments && post.comments.length > 0) {
                const level2Radius = 60; // Distance from parent
                // Spread comments in a fan shape outward from the parent
                const startAngle = angle - Math.PI / 4;
                const totalSpread = Math.PI / 2;

                post.comments.forEach((comment, cIndex) => {
                    // Simple logic for now: just one level deep visualization to keep it clean-ish or recursive?
                    // Let's do 1 level deep for "Spokes" idea
                    const commentAngle = startAngle + (cIndex / Math.max(1, post.comments.length - 1)) * totalSpread;
                    // Adjust angle to point away from center roughly
                    // Actually, just pointing outwards from the parent in the direction of parent's angle

                    // Better approach for level 2: 
                    // Extend the radius from center, but add some jitter or fan
                    const l2X = x + level2Radius * Math.cos(angle + (cIndex - post.comments.length / 2) * 0.2);
                    const l2Y = y + level2Radius * Math.sin(angle + (cIndex - post.comments.length / 2) * 0.2);

                    const commentNode: Node = {
                        id: comment.id,
                        x: l2X,
                        y: l2Y,
                        radius: 6,
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
        <div ref={containerRef} className="w-full h-[500px] overflow-hidden bg-background mb-8 rounded-lg border border-border/50 relative">
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
