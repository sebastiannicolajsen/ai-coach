// Rows and prompts can differ in spacing or pasted-content markers, so match on a short normalised head.
export const noteKey = (text: string): string => text.replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 40)
