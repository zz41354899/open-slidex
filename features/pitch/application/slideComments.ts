export type SlideComment = {
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string | null;
  id: string;
  resolvedAt: string | null;
  status: "open" | "resolved";
  updatedAt: string | null;
  version: number;
};

export type SlideComments = Record<number, SlideComment[]>;

export type SlideCommentAuthor = {
  id: string;
  name: string;
};

export const localSlideCommentAuthor = {
  id: "local-user",
  name: "You"
} satisfies SlideCommentAuthor;

export function appendSlideComment(
  comments: SlideComments,
  slideIndex: number,
  body: string,
  author: SlideCommentAuthor = localSlideCommentAuthor,
  createdAt = new Date().toISOString()
): SlideComments {
  const currentComments = comments[slideIndex] ?? [];
  const version = currentComments.reduce((highest, comment) => Math.max(highest, comment.version), 0) + 1;
  const nextComment: SlideComment = {
    authorId: author.id,
    authorName: author.name,
    body: body.trim(),
    createdAt,
    id: `${createdAt}-${author.id}-${version}`,
    resolvedAt: null,
    status: "open",
    updatedAt: null,
    version
  };

  return { ...comments, [slideIndex]: [...currentComments, nextComment] };
}

export function resolveSlideComment(
  comments: SlideComments,
  slideIndex: number,
  commentId: string,
  resolvedAt = new Date().toISOString()
): SlideComments {
  return updateSlideComment(comments, slideIndex, commentId, (comment) => ({
    ...comment,
    resolvedAt,
    status: "resolved"
  }));
}

export function removeSlideComment(
  comments: SlideComments,
  slideIndex: number,
  commentId: string
): SlideComments {
  const currentComments = comments[slideIndex] ?? [];
  const nextComments = currentComments.filter((comment) => comment.id !== commentId);
  if (nextComments.length === currentComments.length) return comments;

  if (nextComments.length === 0) {
    const remainingComments = { ...comments };
    delete remainingComments[slideIndex];
    return remainingComments;
  }

  return { ...comments, [slideIndex]: nextComments };
}

function updateSlideComment(
  comments: SlideComments,
  slideIndex: number,
  commentId: string,
  update: (comment: SlideComment) => SlideComment
): SlideComments {
  const currentComments = comments[slideIndex] ?? [];
  return {
    ...comments,
    [slideIndex]: currentComments.map((comment) => comment.id === commentId ? update(comment) : comment)
  };
}
