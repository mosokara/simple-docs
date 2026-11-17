export type LibraryItemKind = "note" | "snippet";

export type LibraryNote = {
  id: string;
  title: string;
  content: string;
  kind: LibraryItemKind;
  language: string | null;
  favorite: boolean;
  categoryId: string | null;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string | null;
  tags: string[];
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
  categoryId?: string | null;
};
