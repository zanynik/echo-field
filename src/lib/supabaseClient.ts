import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://knyugfafvvwjbeqdrlka.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtueXVnZmFmdnZ3amJlcWRybGthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDk2NTIxNzAsImV4cCI6MjAyNTIyODE3MH0.Wd0VQMt0I8CWvX1l-WqWvPYT4JlzEzUxGFrWXS7xwDM';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);