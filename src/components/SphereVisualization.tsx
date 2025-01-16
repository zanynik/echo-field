import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry';
import { supabase } from "@/lib/supabaseClient";

interface SphereVisualizationProps {
    highlightedIds?: string[];
  }

interface TreeNode {
  id: string;
  parent_id: string | null;
  children: TreeNode[];
}

const SphereVisualization = ({ highlightedIds = [] }: SphereVisualizationProps) => {
    console.log("Highlighted IDs in SphereVisualization:", highlightedIds); // Debugging line
    const containerRef = useRef<HTMLDivElement>(null);
    const [posts, setPosts] = useState<any[]>([]);
    const [theme, setTheme] = useState<'dark' | 'light'>('dark'); // Default to dark theme

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
    scene.background = new THREE.Color(theme === 'dark' ? 0xffffff : 0x000000);
    const camera = new THREE.PerspectiveCamera(
      75,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    containerRef.current.appendChild(renderer.domElement);
  
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
  
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);
  
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);
  
    const dotGeometry = new THREE.BufferGeometry();
    const dotMaterial = new THREE.PointsMaterial({
      color: theme === 'dark' ? 0x000000 : 0xffffff,
      size: 0.2,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.7,
      vertexColors: true,
    });
  
    const positions: number[] = [];
    const colors: number[] = [];
  
    const addDots = (node: TreeNode, parentPosition = new THREE.Vector3(0, 0, 0), depth = 0) => {
        const isHighlighted = highlightedIds.includes(node.id);
        console.log(`Node ID: ${node.id}, Highlighted: ${isHighlighted}`); // Debugging line
      
        const color = isHighlighted ? new THREE.Color(0xff0000) : new THREE.Color(theme === 'dark' ? 0x000000 : 0xffffff);
      
        positions.push(parentPosition.x, parentPosition.y, parentPosition.z);
        colors.push(color.r, color.g, color.b);
      
        if (node.children.length > 0) {
          const radius = depth * 1.5 + 1;
          const angleIncrement = (2 * Math.PI) / node.children.length;
      
          node.children.forEach((child, index) => {
            const angle = angleIncrement * index;
            const x = parentPosition.x + radius * Math.cos(angle);
            const y = parentPosition.y + radius * Math.sin(angle);
            const z = parentPosition.z;
            const childPosition = new THREE.Vector3(x, y, z);
      
            addDots(child, childPosition, depth + 1);
          });
        }
      };
  
    addDots(tree);
    dotGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    dotGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  
    const dots = new THREE.Points(dotGeometry, dotMaterial);
    scene.add(dots);
  
    const rootGeometry = new THREE.SphereGeometry(0.5, 32, 32);
    const rootMaterial = new THREE.MeshStandardMaterial({ 
      color: theme === 'dark' ? 0xffffff : 0x000000,
      emissive: theme === 'dark' ? 0x000000 : 0xffffff,
    });
    const root = new THREE.Mesh(rootGeometry, rootMaterial);
    scene.add(root);
  
    const fontLoader = new FontLoader();
    fontLoader.load('/fonts/helvetiker_regular.typeface.json', (font) => {
      const textGeometry = new TextGeometry('hello, world', {
        size: 0.2,
        depth: 0.02,
        font: font,
      });
      const textMaterial = new THREE.MeshBasicMaterial({ 
        color: theme === 'dark' ? 0x000000 : 0xffffff,
      });
      const textMesh = new THREE.Mesh(textGeometry, textMaterial);
      textMesh.position.set(0, 0.8, 0);
      root.add(textMesh);
    });
  
    camera.position.z = 5;
  
    const animate = () => {
      requestAnimationFrame(animate);
      dots.rotation.y += 0.002;
      controls.update();
      renderer.render(scene, camera);
    };
  
    animate();
  
    const handleResize = () => {
      if (!containerRef.current) return;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
  
    window.addEventListener('resize', handleResize);
  
    return () => {
      window.removeEventListener('resize', handleResize);
      containerRef.current?.removeChild(renderer.domElement);
    };
  }, [posts, theme, highlightedIds]);
  
  return <div ref={containerRef} style={{ width: '100%', height: '400px' }} />;
};

export default SphereVisualization;