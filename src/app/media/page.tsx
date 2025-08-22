
"use client";

import { useState, useEffect } from "react";
import type { MediaFile } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { uploadMedia, getMediaFiles, deleteMediaFile } from "@/services/mediaService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { UploadCloud, Copy, Trash2, Loader2 } from "lucide-react";
import { Sidebar, SidebarContent, SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { useRouter } from 'next/navigation';
import AppHeader from "@/components/app-header";
import { format } from 'date-fns';

export default function MediaPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { toast } = useToast();

  const isCompanyAdmin = user?.role_id === 2;

  useEffect(() => {
    if (!isCompanyAdmin) {
        router.replace('/');
        return;
    }
    fetchMediaFiles();
  }, [isCompanyAdmin, router]);

  const fetchMediaFiles = async () => {
    setLoading(true);
    try {
      const files = await getMediaFiles();
      setMediaFiles(Array.isArray(files) ? files : []);
    } catch (error) {
      toast({
        title: "Error fetching media",
        description: "Could not load media files.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast({ title: "No file selected", description: "Please choose a file to upload.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      await uploadMedia(selectedFile);
      toast({ title: "Success", description: "File uploaded successfully." });
      setSelectedFile(null); 
      // Clear the input visually
      const input = document.getElementById('file-upload') as HTMLInputElement;
      if (input) input.value = '';
      fetchMediaFiles(); 
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || "Failed to upload file.";
      toast({ title: "Upload Error", description: errorMessage, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };
  
  const handleDelete = async (fileId: number) => {
    try {
      await deleteMediaFile(fileId);
      toast({ title: "Success", description: "File deleted successfully." });
      fetchMediaFiles();
    } catch (error: any) {
        toast({ title: "Error", description: error.response?.data?.message || "Failed to delete file.", variant: "destructive"});
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied!", description: "Link copied to clipboard." });
  }

  if (!isCompanyAdmin) {
    return null; 
  }

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarContent><AppSidebar /></SidebarContent>
      </Sidebar>
      <SidebarInset>
        <div className="flex flex-col min-h-screen">
          <AppHeader user={user} logout={logout} pageTitle="Media Library" />
          <header className="sticky top-16 z-20 flex items-center justify-between h-16 px-4 md:px-8 border-b bg-background/80 backdrop-blur-sm">
            <h1 className="text-xl font-bold">Media Library</h1>
            <div className="flex items-center gap-2">
                <Input id="file-upload" type="file" onChange={handleFileChange} className="max-w-xs" />
                <Button onClick={handleUpload} disabled={uploading || !selectedFile}>
                  {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
                  {uploading ? 'Uploading...' : 'Upload'}
                </Button>
            </div>
          </header>

          <main className="flex-1 p-4 md:p-8 bg-muted/40">
            <Card>
              <CardHeader>
                <CardTitle>Uploaded Files</CardTitle>
                <CardDescription>Manage your company's media assets.</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? <p>Loading...</p> : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>File Name</TableHead>
                        <TableHead>URL</TableHead>
                        <TableHead>Uploaded At</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mediaFiles.length > 0 ? mediaFiles.map((file) => (
                        <TableRow key={file.id}>
                          <TableCell className="font-medium">{file.file_name}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                                <Input type="text" readOnly value={file.file_url} className="flex-1" />
                                <Button variant="ghost" size="icon" onClick={() => copyToClipboard(file.file_url)}>
                                    <Copy className="h-4 w-4" />
                                </Button>
                            </div>
                          </TableCell>
                          <TableCell>{format(new Date(file.created_at), 'PPp')}</TableCell>
                          <TableCell className="text-right">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                  <AlertDialogDescription>This action will permanently delete the file.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(file.id)}>Delete</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        </TableRow>
                      )) : (
                        <TableRow><TableCell colSpan={4} className="text-center h-24">No media files found. Upload one to get started.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
