import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { supabase } from "@/lib/supabaseClient";

interface TreeNode {
  id: string;
  parent_id: string | null;
  children: TreeNode[];
}

const SphereVisualization = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [posts, setPosts] = useState<any[]>([]);

  useEffect(() => {
    // Fetch posts from Supabase
    const fetchPosts = async () => {
      const { data, error } = await supabase
        .from('posts')
        .select('id, parent_id')
        .order('id', { ascending: true });

      if (error) {
        console.error('Error fetching posts:', error);
        return;
      }

      setPosts(data || []);
    };

    fetchPosts();
  }, []);

  useEffect(() => {
    if (!containerRef.current || posts.length === 0) return;

    // Build tree structure
    const buildTree = (data: any[]) => {
      const tree: { [key: string]: TreeNode } = {};

      // First pass: initialize all nodes
      data.forEach(item => {
        if (!tree[item.id]) {
          tree[item.id] = { ...item, children: [] };
        }
      });

      // Second pass: build parent-child relationships
      data.forEach(item => {
        if (item.parent_id && tree[item.parent_id]) {
          tree[item.parent_id].children.push(tree[item.id]);
        }
      });

      // Find root node (node with no parent)
      const rootNode = Object.values(tree).find(node => !node.parent_id);
      return rootNode || tree[Object.keys(tree)[0]];
    };

    const tree = buildTree(posts);

    // Three.js setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x101010);
    const camera = new THREE.PerspectiveCamera(
      75,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    containerRef.current.appendChild(renderer.domElement);

    // Orbit controls for smooth interaction
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // Add ambient and directional lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    // Create dots
    const dotGeometry = new THREE.BufferGeometry();
    const dotMaterial = new THREE.PointsMaterial({
      color: 0x00ff88,
      size: 0.2,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.7,
    });

    const positions: number[] = [];
    const addDots = (node: TreeNode, parentPosition = new THREE.Vector3(0, 0, 0), depth = 0) => {
      // Add position for current node
      positions.push(parentPosition.x, parentPosition.y, parentPosition.z);

      if (node.children.length > 0) {
        const radius = depth * 1.5 + 1; // Maintain spacing between nodes
        const angleIncrement = (2 * Math.PI) / node.children.length;

        node.children.forEach((child, index) => {
          const angle = angleIncrement * index;
          const x = parentPosition.x + radius * Math.cos(angle);
          const y = parentPosition.y + radius * Math.sin(angle);
          const z = parentPosition.z;
          addDots(child, new THREE.Vector3(x, y, z), depth + 1);
        });
      }
    };

    addDots(tree);
    dotGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

    const dots = new THREE.Points(dotGeometry, dotMaterial);
    scene.add(dots);

    // Add root node (larger and distinct)
    const rootGeometry = new THREE.SphereGeometry(0.5, 32, 32);
    const rootMaterial = new THREE.MeshStandardMaterial({ color: 0xff4444, emissive: 0xaa0000 });
    const root = new THREE.Mesh(rootGeometry, rootMaterial);
    scene.add(root);

    camera.position.z = 15;

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      dots.rotation.y += 0.002; // Subtle rotation for better visuals
      controls.update(); // Enable damping effect
      renderer.render(scene, camera);
    };

    animate();

    // Handle window resize
    const handleResize = () => {
      if (!containerRef.current) return;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      containerRef.current?.removeChild(renderer.domElement);
    };
  }, [posts]);

  return <div ref={containerRef} style={{ width: '100%', height: '400px' }} />;
};

export default SphereVisualization;
