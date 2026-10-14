import React from 'react';
import {
  FileText,
  FileImage,
  FileVideo,
  FileArchive,
  FileCode,
  File,
} from 'lucide-react';

interface FileTypeIconProps {
  format?: string;
  resourceType?: string;
  className?: string;
}

export default function FileTypeIcon({
  format = '',
  resourceType = 'raw',
  className = 'h-5 w-5',
}: FileTypeIconProps) {
  const ext = format.toLowerCase();

  if (['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif'].includes(ext) || resourceType === 'image') {
    return <FileImage className={`${className} text-emerald-500`} aria-hidden="true" />;
  }

  if (['mp4', 'webm', 'mov'].includes(ext) || resourceType === 'video') {
    return <FileVideo className={`${className} text-indigo-500`} aria-hidden="true" />;
  }

  if (['zip', 'rar', 'tar', 'gz', '7z'].includes(ext)) {
    return <FileArchive className={`${className} text-amber-500`} aria-hidden="true" />;
  }

  if (['js', 'ts', 'jsx', 'tsx', 'html', 'css', 'json'].includes(ext)) {
    return <FileCode className={`${className} text-cyan-500`} aria-hidden="true" />;
  }

  if (['pdf'].includes(ext)) {
    return <FileText className={`${className} text-red-500`} aria-hidden="true" />;
  }

  if (['doc', 'docx', 'txt', 'csv', 'xlsx', 'xls'].includes(ext)) {
    return <FileText className={`${className} text-blue-500`} aria-hidden="true" />;
  }

  return <File className={`${className} text-muted-foreground`} aria-hidden="true" />;
}
