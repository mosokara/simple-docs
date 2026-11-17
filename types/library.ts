export type LibraryItemKind = "note" | "snippet";

export type LibraryNote = {
  id: string;
  title: string;
  content: string;
  kind: LibraryItemKind;
  language: string | null;
  favorite: boolean;
  categoryId: string | null;
  folderId: string | null;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string | null;
  tags: string[];
};

export type LibraryFolder = {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
};

export type LibraryCategory = {
  id: string;
  name: string;
  color?: string | null;
};

export type SaveLibraryItemInput = {
  id?: string;
  title: string;
  content: string;
  kind: LibraryItemKind;
  language?: string | null;
  folderId?: string | null;
  categoryId?: string | null;
};
