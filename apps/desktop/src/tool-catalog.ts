export const toolHelp: Record<string, string> = {
  "Add text":
    "Click the page and type. Enter saves; Shift Enter adds a line. texto escrever inserir",
  "Insert image":
    "Place a photo or logo, then resize, replace or move it. imagem foto",
  "Find & replace text":
    "Preview replacements across pages and apply them in one undoable step. buscar substituir texto",
  "Page contents":
    "Find text, images and marks even when they overlap. conteúdo objetos camadas",
  "Insert current date": "Add today’s date as editable text. data hoje",
  "Signature Studio":
    "Calligraphy, personal handwriting and monograms. assinatura rubrica",
  "Ink Studio · refine a drawing":
    "Steady rough strokes and rebuild geometric shapes. desenho reconstruir",
  "Insert PDF / Merge":
    "Insert another PDF at the beginning, end or a chosen page. juntar mesclar",
  "Extract pages": "Choose pages to save in a separate PDF. extrair separar",
  "Add page numbers": "Number a chosen page range. numeração páginas",
  "Add watermark": "Add text behind or over pages. marca água",
  "Create form field":
    "Create editable text fields or checkboxes. formulário campo",
  "Fill form fields": "Fill existing interactive fields. preencher",
  "Flatten form fields":
    "Turn field appearances into ordinary page content. achatar",
  "OCR searchable text":
    "Recognize scanned pages locally; add a searchable text layer. digitalização reconhecer",
  "Compare PDFs":
    "Inspect visual and text differences between two documents. comparar revisão",
  "Compress PDF":
    "Optimize file structure or make a smaller image-based copy. comprimir tamanho",
  "Secure image redaction":
    "Permanently remove a region in a rasterized copy. ocultar censurar remover",
  "Remove private data":
    "Remove metadata and annotations from the working document. privacidade limpar",
  "Password-protect a copy":
    "Create an encrypted PDF with a password. senha proteger",
  "Inspect document fonts and objects":
    "Locate font usage and inspect page content. fontes objetos",
  "Export page as PNG": "Save the current page as an image. converter imagem",
  "Export text":
    "Extract the document’s text into a text file. extrair converter",
  "Save as": "Choose a new filename and export options. salvar cópia",
  Settings:
    "Appearance, motion, editing and shortcuts. configurações preferências",
};
export const toolDescription = (name: string) =>
  (toolHelp[name] ?? "").split(/\. [a-záàâãéêíóôõúç]+(?: |$)/)[0];
export const toolSearch = (name: string, group: string, query: string) =>
  query
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .every((q) =>
      (name + " " + group + " " + (toolHelp[name] ?? ""))
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .includes(q.normalize("NFD").replace(/[\u0300-\u036f]/g, "")),
    );
