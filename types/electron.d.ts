import type { LibraryFolder, LibraryNote, SaveLibraryItemInput } from "./library";

declare global {
  interface Window {
    simpleDocs?: {
      listLibraryItems(options?: { query?: string; kind?: "all" | "note" | "snippet"; favoritesOnly?: boolean; recentOnly?: boolean; folderId?: string | null }): Promise<LibraryNote[]>;
      openLibraryItem(id: string): Promise<LibraryNote>;
      saveLibraryItem(input: SaveLibraryItemInput): Promise<LibraryNote>;
      deleteLibraryItem(id: string): Promise<boolean>;
      setLibraryFavorite(id: string, favorite: boolean): Promise<LibraryNote>;
      listFolders(): Promise<LibraryFolder[]>;
      createFolder(name: string, parentId?: string | null): Promise<LibraryFolder>;
      renameFolder(id: string, name: string): Promise<LibraryFolder>;
      deleteFolder(id: string): Promise<boolean>;
      openExternalUrl(url: string): Promise<{ ok: boolean }>;
    };
  }
}

export {};
