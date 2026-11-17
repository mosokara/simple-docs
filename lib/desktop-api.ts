"use client";

import type { LibraryFolder, LibraryNote, SaveLibraryItemInput } from "@/types/library";

export function isDesktopAvailable() {
  return typeof window !== "undefined" && !!window.simpleDocs;
}

function api() {
  if (!isDesktopAvailable()) throw new Error("Simple Docs desktop bridge is not available.");
  return window.simpleDocs!;
}

export const desktop = {
  listLibraryItems: (options?: { query?: string; kind?: "all" | "note" | "snippet"; favoritesOnly?: boolean; recentOnly?: boolean; folderId?: string | null }): Promise<LibraryNote[]> => api().listLibraryItems(options),
  openLibraryItem: (id: string): Promise<LibraryNote> => api().openLibraryItem(id),
  saveLibraryItem: (input: SaveLibraryItemInput): Promise<LibraryNote> => api().saveLibraryItem(input),
  deleteLibraryItem: (id: string): Promise<boolean> => api().deleteLibraryItem(id),
  setLibraryFavorite: (id: string, favorite: boolean): Promise<LibraryNote> => api().setLibraryFavorite(id, favorite),
  listFolders: (): Promise<LibraryFolder[]> => api().listFolders(),
  createFolder: (name: string, parentId?: string | null): Promise<LibraryFolder> => api().createFolder(name, parentId),
  renameFolder: (id: string, name: string): Promise<LibraryFolder> => api().renameFolder(id, name),
  deleteFolder: (id: string): Promise<boolean> => api().deleteFolder(id),
  openExternalUrl: (url: string) => api().openExternalUrl(url),
} as const;
