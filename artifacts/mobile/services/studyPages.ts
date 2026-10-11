import type { BoardPageConfig, Phase1CitationImage, QueryImagesResponse, QueryResponse } from "./api";

type DisplayMode = BoardPageConfig["page_display_mode"];

/** Only presentation cleanup: never select pages or alter answer/source facts. */
export function streamedAnswerForDisplay(answer: QueryResponse, mode: DisplayMode): QueryResponse {
  if (!answer.answer_not_found && mode !== "edwai_generated") return answer;
  if (!answer.answer_not_found && answer.answerTransport === "json") return { ...answer, diagram_images: [] };
  return {
    ...answer,
    sources: answer.sources?.map(source => {
      const { base64_images: _images, ...facts } = source;
      return facts;
    }),
    phase1_citations: [],
    diagram_images: [],
  };
}

/** Consume the server's ordered physical IDs, without deriving pages from citations. */
export async function fetchStudyPages(
  answer: QueryResponse,
  mode: DisplayMode,
  signal: AbortSignal,
  calls: {
    generated: (documentId: number, filename: string) => Promise<string>;
    standard: (body: { document_id: number; pages: number[]; primary_pages: number[]; include_diagrams: boolean }) => Promise<QueryImagesResponse>;
  },
): Promise<QueryImagesResponse | null> {
  if (signal.aborted || answer.answerTransport === "json" || answer.answer_not_found || !answer.document_id || !answer.image_source_pages?.length) return null;
  const primary = answer.image_primary_pages ?? [];
  if (mode !== "edwai_generated") {
    return calls.standard({
      document_id: answer.document_id,
      pages: answer.image_source_pages,
      primary_pages: primary,
      include_diagrams: answer.is_visual_question || false,
    });
  }
  const items = await Promise.all(answer.image_source_pages.slice(0, 5).map(async page => {
    const filename = `page_${String(page).padStart(3, "0")}.png`;
    try {
      const data = await calls.generated(answer.document_id!, filename);
      return { page, data, filename, image_role: primary.includes(page) ? "direct_match" : "nearby_context" } satisfies Phase1CitationImage;
    } catch {
      // Missing, unpublished, or rejected images never authorize an original-page fallback.
      return null;
    }
  }));
  if (signal.aborted) return null;
  const successful = items.filter((item): item is NonNullable<typeof item> => item !== null);
  return {
    citation_images: [
      ...successful.filter(item => item.image_role === "direct_match"),
      ...successful.filter(item => item.image_role !== "direct_match"),
    ],
    diagram_images: [],
    page_display_mode: mode,
  };
}

export function attachStudyPages(answer: QueryResponse, images: QueryImagesResponse, mode: DisplayMode): QueryResponse {
  return {
    ...answer,
    sources: answer.sources?.map((source, index) => index === 0 ? { ...source, base64_images: images.citation_images } : source),
    diagram_images: mode === "edwai_generated" ? [] : images.diagram_images,
  };
}
