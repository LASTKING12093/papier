use crate::{fail, structure, Result};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use pdfium_render::prelude::*;
use serde::{Deserialize, Serialize};
use std::{io::Cursor, path::Path};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Rect {
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
}
impl Rect {
    pub fn validate(&self) -> Result<()> {
        if [self.x, self.y, self.width, self.height]
            .iter()
            .any(|v| !v.is_finite())
            || self.width <= 0.
            || self.height <= 0.
            || self.width > 14400.
            || self.height > 14400.
        {
            return fail("Invalid PDF coordinates.");
        }
        Ok(())
    }
    fn pdf(&self, height: f32) -> PdfRect {
        PdfRect::new_from_values(
            height - self.y - self.height,
            self.x,
            height - self.y,
            self.x + self.width,
        )
    }
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PageInfo {
    pub width: f32,
    pub height: f32,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentInfo {
    pub pages: Vec<PageInfo>,
    pub signatures: usize,
    pub bytes: usize,
    pub metadata: serde_json::Value,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectInfo {
    pub index: usize,
    pub kind: String,
    pub bounds: Rect,
    pub text: Option<String>,
    pub font: Option<String>,
    pub size: Option<f32>,
    pub color: [u8; 4],
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OcrWord {
    pub text: String,
    pub rect: Rect,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum EditCommand {
    Rotate {
        pages: Vec<u16>,
        degrees: i32,
    },
    Reorder {
        order: Vec<u16>,
    },
    DeletePages {
        pages: Vec<u16>,
    },
    DuplicatePage {
        page: u16,
    },
    BlankPage {
        after: u16,
        width: f32,
        height: f32,
    },
    Crop {
        pages: Vec<u16>,
        rect: Rect,
    },
    EditText {
        page: u16,
        object: usize,
        text: String,
        font: Option<String>,
        size: f32,
        color: [u8; 4],
    },
    AddText {
        page: u16,
        rect: Rect,
        text: String,
        font: String,
        size: f32,
        color: [u8; 4],
    },
    AddParagraph {
        page: u16,
        rect: Rect,
        text: String,
        font: String,
        size: f32,
        color: [u8; 4],
    },
    DeleteObject {
        page: u16,
        object: usize,
    },
    DuplicateObject {
        page: u16,
        object: usize,
    },
    Arrange {
        page: u16,
        object: usize,
        position: String,
    },
    Transform {
        page: u16,
        object: usize,
        dx: f32,
        dy: f32,
        sx: f32,
        sy: f32,
        degrees: f32,
    },
    Image {
        page: u16,
        object: Option<usize>,
        rect: Rect,
        data: String,
    },
    Shape {
        page: u16,
        rect: Rect,
        shape: String,
        color: [u8; 4],
        width: f32,
        fill: bool,
    },
    Ink {
        page: u16,
        points: Vec<[f32; 2]>,
        color: [u8; 4],
        width: f32,
    },
    Signature {
        page: u16,
        paths: Vec<Vec<[f32; 2]>>,
        color: [u8; 4],
        width: f32,
    },
    FilledMark {
        page: u16,
        paths: Vec<Vec<[f32; 2]>>,
        color: [u8; 4],
        width: f32,
    },
    Brush {
        page: u16,
        paths: Vec<Vec<[f32; 2]>>,
        color: [u8; 4],
        width: f32,
    },
    Annotation {
        page: u16,
        rect: Rect,
        subtype: String,
        text: String,
        color: [u8; 4],
    },
    DeleteAnnotation {
        page: u16,
        index: usize,
    },
    Link {
        page: u16,
        rect: Rect,
        url: String,
    },
    Metadata {
        values: std::collections::BTreeMap<String, String>,
    },
    Sanitize,
    Bookmark {
        title: String,
        page: u16,
    },
    DeleteBookmark {
        index: usize,
    },
    Field {
        page: u16,
        rect: Rect,
        name: String,
        field_type: String,
        value: String,
        required: bool,
    },
    FillField {
        name: String,
        value: String,
    },
    FlattenForms,
    Watermark {
        text: String,
        size: f32,
        opacity: u8,
        degrees: f32,
        pages: Vec<u16>,
    },
    PageNumbers {
        prefix: String,
        start: u32,
        pages: Vec<u16>,
    },
    Compress,
    Ocr {
        page: u16,
        words: Vec<OcrWord>,
    },
}
impl EditCommand {
    pub fn label(&self) -> &'static str {
        match self {
            Self::Ocr { .. } => "OCR text layer",
            Self::Rotate { .. } => "Rotate pages",
            Self::Reorder { .. } => "Reorder pages",
            Self::DeletePages { .. } => "Delete pages",
            Self::DuplicatePage { .. } => "Duplicate page",
            Self::BlankPage { .. } => "Insert blank page",
            Self::Crop { .. } => "Crop pages",
            Self::EditText { .. } => "Edit text",
            Self::AddText { .. } => "Add text",
            Self::AddParagraph { .. } => "Add paragraph",
            Self::DeleteObject { .. } => "Delete object",
            Self::DuplicateObject { .. } => "Duplicate object",
            Self::Arrange { .. } => "Arrange object",
            Self::Transform { .. } => "Transform object",
            Self::Image { .. } => "Edit image",
            Self::Shape { .. } => "Add shape",
            Self::Ink { .. } => "Draw",
            Self::Signature { .. } => "Place signature",
            Self::FilledMark { .. } => "Place calligraphic signature",
            Self::Brush { .. } => "Brush stroke",
            Self::Annotation { .. } => "Add annotation",
            Self::DeleteAnnotation { .. } => "Delete annotation",
            Self::Link { .. } => "Add link",
            Self::Metadata { .. } => "Edit metadata",
            Self::Sanitize => "Sanitize",
            Self::Bookmark { .. } => "Add bookmark",
            Self::DeleteBookmark { .. } => "Delete bookmark",
            Self::Field { .. } => "Create form field",
            Self::FillField { .. } => "Fill form field",
            Self::FlattenForms => "Flatten forms",
            Self::Watermark { .. } => "Add watermark",
            Self::PageNumbers { .. } => "Add page numbers",
            Self::Compress => "Optimize streams",
        }
    }
}

pub struct PdfEngine {
    pdfium: Pdfium,
}
fn pt(v: f32) -> PdfPoints {
    PdfPoints::new(v)
}
fn color(v: [u8; 4]) -> PdfColor {
    PdfColor::new(v[0], v[1], v[2], v[3])
}
fn font(doc: &mut PdfDocument, name: &str) -> Result<PdfFontToken> {
    Ok(match name {
        "Noto Sans" => doc.fonts_mut().load_true_type_from_bytes(
            include_bytes!("../../../assets/fonts/NotoSans-Regular.ttf"),
            true,
        )?,
        "Manrope" => doc
            .fonts_mut()
            .load_true_type_from_bytes(include_bytes!("../../../assets/fonts/Manrope.ttf"), true)?,
        "Noto Serif" => doc.fonts_mut().load_true_type_from_bytes(
            include_bytes!("../../../assets/fonts/NotoSerif.ttf"),
            true,
        )?,
        "Noto Serif Italic" => doc.fonts_mut().load_true_type_from_bytes(
            include_bytes!("../../../assets/fonts/NotoSerif-Italic.ttf"),
            true,
        )?,
        "Roboto Mono" => doc.fonts_mut().load_true_type_from_bytes(
            include_bytes!("../../../assets/fonts/RobotoMono.ttf"),
            true,
        )?,
        "Cormorant Garamond" => doc.fonts_mut().load_true_type_from_bytes(
            include_bytes!("../../../assets/fonts/CormorantGaramond.ttf"),
            true,
        )?,
        "Caveat" => doc
            .fonts_mut()
            .load_true_type_from_bytes(include_bytes!("../../../assets/fonts/Caveat.ttf"), true)?,
        "Helvetica" => doc.fonts_mut().helvetica(),
        "Helvetica-Bold" => doc.fonts_mut().helvetica_bold(),
        "Helvetica-Oblique" => doc.fonts_mut().helvetica_oblique(),
        "Helvetica-BoldOblique" => doc.fonts_mut().helvetica_bold_oblique(),
        "Times-Bold" => doc.fonts_mut().times_bold(),
        "Times-BoldItalic" => doc.fonts_mut().times_bold_italic(),
        "Courier-Bold" => doc.fonts_mut().courier_bold(),
        "Courier-Oblique" => doc.fonts_mut().courier_oblique(),
        "Courier-BoldOblique" => doc.fonts_mut().courier_bold_oblique(),
        "Times-Roman" => doc.fonts_mut().times_roman(),
        "Times-Italic" => doc.fonts_mut().times_italic(),
        "Courier" => doc.fonts_mut().courier(),
        _ => return fail("Select one of the available replacement fonts."),
    })
}
fn check_text(text: &str, size: f32) -> Result<()> {
    if text.len() > 100_000 || text.contains('\0') || !(1.0..=500.).contains(&size) {
        return fail("Text or font size is outside the supported range.");
    }
    Ok(())
}
impl PdfEngine {
    pub fn new(library: &Path) -> Result<Self> {
        Ok(Self {
            pdfium: match Pdfium::bind_to_library(library) {
                Ok(bindings) => Pdfium::new(bindings),
                Err(PdfiumError::PdfiumLibraryBindingsAlreadyInitialized) => Pdfium::default(),
                Err(e) => return Err(e.into()),
            },
        })
    }
    pub fn info(&self, bytes: &[u8]) -> Result<DocumentInfo> {
        let doc = self.pdfium.load_pdf_from_byte_slice(bytes, None)?;
        if doc.pages().len() > 10000 {
            return fail("This document exceeds the 10,000-page safety limit.");
        }
        let pages = doc
            .pages()
            .iter()
            .map(|p| PageInfo {
                width: p.width().value,
                height: p.height().value,
            })
            .collect();
        Ok(DocumentInfo {
            pages,
            signatures: doc.signatures().len() as usize,
            bytes: bytes.len(),
            metadata: structure::properties(bytes)?,
        })
    }
    pub fn create(&self) -> Result<Vec<u8>> {
        self.create_sized(595.276, 841.89, 1)
    }
    pub fn create_sized(&self, width: f32, height: f32, count: usize) -> Result<Vec<u8>> {
        if !(72.0..=14400.0).contains(&width)
            || !(72.0..=14400.0).contains(&height)
            || !(1..=200).contains(&count)
        {
            return fail("Choose valid page dimensions and 1–200 initial pages.");
        }
        let mut doc = self.pdfium.create_new_pdf()?;
        for _ in 0..count {
            doc.pages_mut()
                .create_page_at_end(PdfPagePaperSize::Custom(pt(width), pt(height)))?;
        }
        Ok(doc.save_to_bytes()?)
    }
    pub fn render(&self, bytes: &[u8], page: u16, width: i32) -> Result<Vec<u8>> {
        if !(32..=4096).contains(&width) {
            return fail("Render width must be between 32 and 4096 pixels.");
        }
        let doc = self.pdfium.load_pdf_from_byte_slice(bytes, None)?;
        let page = doc.pages().get(page as i32)?;
        let estimated_height = width as f32 * page.height().value / page.width().value;
        if !estimated_height.is_finite()
            || estimated_height > 8192.
            || width as f32 * estimated_height > 24_000_000.
        {
            return fail("This page exceeds the rendering memory limit. Reduce zoom.");
        }
        let image = page
            .render_with_config(
                &PdfRenderConfig::new()
                    .set_target_width(width)
                    .render_annotations(true),
            )?
            .as_image()?;
        let mut out = Cursor::new(Vec::new());
        image.write_to(&mut out, image::ImageFormat::Png)?;
        Ok(out.into_inner())
    }
    /// Read-only compositing layers. The document bytes and object order are never mutated.
    pub fn object_layers(
        &self,
        bytes: &[u8],
        page_index: u16,
        selected: usize,
        width: i32,
    ) -> Result<Vec<String>> {
        if !(32..=2400).contains(&width) {
            return fail("Preview width must be between 32 and 2400 pixels.");
        }
        let doc = self.pdfium.load_pdf_from_byte_slice(bytes, None)?;
        let page = doc.pages().get(page_index as i32)?;
        page.objects().get(selected)?;
        let height = width as f32 * page.height().value / page.width().value;
        if !height.is_finite() || height > 4096. || width as f32 * height > 8_000_000. {
            return fail("Reduce zoom to prepare object editing layers.");
        }
        let mut result = Vec::new();
        for layer in 0..3 {
            for (index, mut object) in page.objects().iter().enumerate() {
                let visible = match layer {
                    0 => index < selected,
                    1 => index == selected,
                    _ => index > selected,
                };
                if visible {
                    object.set_active()?;
                } else {
                    object.set_inactive()?;
                }
            }
            let image = page
                .render_with_config(
                    &PdfRenderConfig::new()
                        .set_target_width(width)
                        .set_clear_color(if layer == 0 {
                            PdfColor::WHITE
                        } else {
                            PdfColor::new(0, 0, 0, 0)
                        })
                        .render_annotations(layer == 2),
                )?
                .as_image()?;
            let mut out = Cursor::new(Vec::new());
            image.write_to(&mut out, image::ImageFormat::Png)?;
            result.push(format!(
                "data:image/png;base64,{}",
                STANDARD.encode(out.into_inner())
            ));
        }
        Ok(result)
    }
    pub fn inspect(&self, bytes: &[u8], page: u16) -> Result<Vec<ObjectInfo>> {
        let doc = self.pdfium.load_pdf_from_byte_slice(bytes, None)?;
        let page = doc.pages().get(page as i32)?;
        let height = page.height().value;
        let mut out = Vec::new();
        for (index, object) in page.objects().iter().enumerate().take(20000) {
            let b = object.bounds()?;
            let t = object.as_text_object();
            let c = object.fill_color().unwrap_or(PdfColor::BLACK);
            out.push(ObjectInfo {
                index,
                kind: format!("{:?}", object.object_type()).to_lowercase(),
                bounds: Rect {
                    x: b.left().value,
                    y: height - b.top().value,
                    width: b.width().value,
                    height: b.height().value,
                },
                // PDFium can append inferred whitespace after a rotation or scale.
                text: t.map(|v| v.text().trim_end().to_string()),
                font: t.map(|v| v.font().family()),
                size: t.map(|v| {
                    let scale = v.matrix().map(|m| m.c().hypot(m.d())).unwrap_or(1.);
                    v.unscaled_font_size().value * scale
                }),
                color: [c.red(), c.green(), c.blue(), c.alpha()],
            });
        }
        Ok(out)
    }
    pub fn text(&self, bytes: &[u8]) -> Result<Vec<String>> {
        let doc = self.pdfium.load_pdf_from_byte_slice(bytes, None)?;
        doc.pages().iter().map(|p| Ok(p.text()?.all())).collect()
    }
    pub fn merge(&self, bytes: &[u8], other: &[u8]) -> Result<Vec<u8>> {
        let mut doc = self.pdfium.load_pdf_from_byte_slice(bytes, None)?;
        let source = self.pdfium.load_pdf_from_byte_slice(other, None)?;
        doc.pages_mut().append(&source)?;
        Ok(doc.save_to_bytes()?)
    }
    pub fn insert(&self, bytes: &[u8], other: &[u8], at: u16) -> Result<Vec<u8>> {
        let mut doc = self.pdfium.load_pdf_from_byte_slice(bytes, None)?;
        let source = self.pdfium.load_pdf_from_byte_slice(other, None)?;
        if at as i32 > doc.pages().len() {
            return fail("Invalid insertion position.");
        }
        for i in 0..source.pages().len() {
            doc.pages_mut()
                .copy_page_from_document(&source, i, at as i32 + i)?;
        }
        Ok(doc.save_to_bytes()?)
    }
    pub fn extract(&self, bytes: &[u8], pages: &[u16]) -> Result<Vec<u8>> {
        if pages.is_empty() {
            return fail("Select at least one page.");
        }
        let source = self.pdfium.load_pdf_from_byte_slice(bytes, None)?;
        let mut doc = self.pdfium.create_new_pdf()?;
        for &p in pages {
            source.pages().get(p as i32)?;
            let at = doc.pages().len();
            doc.pages_mut()
                .copy_page_from_document(&source, p as i32, at)?;
        }
        Ok(doc.save_to_bytes()?)
    }
    pub fn copy_object(&self, bytes: &[u8], page: u16, index: usize) -> Result<Vec<u8>> {
        let source = self.pdfium.load_pdf_from_byte_slice(bytes, None)?;
        let page = source.pages().get(page as i32)?;
        let mut out = self.pdfium.create_new_pdf()?;
        let mut target = out
            .pages_mut()
            .create_page_at_end(PdfPagePaperSize::Custom(page.width(), page.height()))?;
        page.objects().get(index)?.copy_to_page(&mut target)?;
        drop(target);
        Ok(out.save_to_bytes()?)
    }
    pub fn paste_object(&self, bytes: &[u8], clipboard: &[u8], page: u16) -> Result<Vec<u8>> {
        let doc = self.pdfium.load_pdf_from_byte_slice(bytes, None)?;
        let source = self.pdfium.load_pdf_from_byte_slice(clipboard, None)?;
        let mut target = doc.pages().get(page as i32)?;
        let source_page = source.pages().get(0)?;
        for mut object in source_page.objects().iter() {
            let mut copied = object.copy_to_page(&mut target)?;
            copied.translate(pt(12.), target.height() - source_page.height() - pt(12.))?;
        }
        drop(target);
        Ok(doc.save_to_bytes()?)
    }
    /// Rebuilds the entire file from rendered pixels. No original stream or resource is copied.
    /// This deliberately sacrifices text selection and interactivity for a verifiable output.
    pub fn redact(&self, bytes: &[u8], target: u16, rect: &Rect) -> Result<Vec<u8>> {
        rect.validate()?;
        let source = self.pdfium.load_pdf_from_byte_slice(bytes, None)?;
        source.pages().get(target as i32)?;
        let mut output = self.pdfium.create_new_pdf()?;
        for (index, page) in source.pages().iter().enumerate() {
            let (w, h) = (page.width(), page.height());
            let width = (w.value * 2.).round() as i32;
            let raw = self.render(bytes, index as u16, width)?;
            let mut img = image::load_from_memory(&raw)?.to_rgba8();
            if index == target as usize {
                if rect.x < 0.
                    || rect.y < 0.
                    || rect.x + rect.width > w.value
                    || rect.y + rect.height > h.value
                {
                    return fail("Redaction must stay inside the visible page.");
                }
                let sx = img.width() as f32 / w.value;
                let sy = img.height() as f32 / h.value;
                let x0 = (rect.x * sx).floor() as u32;
                let y0 = (rect.y * sy).floor() as u32;
                let x1 = ((rect.x + rect.width) * sx).ceil() as u32;
                let y1 = ((rect.y + rect.height) * sy).ceil() as u32;
                for y in y0..y1.min(img.height()) {
                    for x in x0..x1.min(img.width()) {
                        img.put_pixel(x, y, image::Rgba([0, 0, 0, 255]));
                    }
                }
            }
            let mut new = output
                .pages_mut()
                .create_page_at_end(PdfPagePaperSize::Custom(w, h))?;
            new.objects_mut().create_image_object(
                pt(0.),
                pt(0.),
                &image::DynamicImage::ImageRgba8(img),
                Some(w),
                Some(h),
            )?;
        }
        let out = output.save_to_bytes()?;
        if self.text(&out)?.iter().any(|s| !s.trim().is_empty()) {
            return fail("Redaction verification failed: text remains in the rebuilt document.");
        }
        Ok(out)
    }
    pub fn edit(&self, bytes: &[u8], cmd: &EditCommand) -> Result<Vec<u8>> {
        match cmd {
            EditCommand::Reorder { .. }
            | EditCommand::DeletePages { .. }
            | EditCommand::Metadata { .. }
            | EditCommand::Sanitize
            | EditCommand::Bookmark { .. }
            | EditCommand::DeleteBookmark { .. }
            | EditCommand::Field { .. }
            | EditCommand::FillField { .. }
            | EditCommand::FlattenForms
            | EditCommand::Annotation { .. }
            | EditCommand::DeleteAnnotation { .. }
            | EditCommand::Link { .. }
            | EditCommand::Compress => return structure::edit(bytes, cmd),
            _ => {}
        }
        let mut doc = self.pdfium.load_pdf_from_byte_slice(bytes, None)?;
        match cmd {
            EditCommand::Rotate { pages, degrees } => {
                if degrees % 90 != 0 {
                    return fail("Rotation must be a multiple of 90 degrees.");
                }
                for &p in pages {
                    let mut page = doc.pages().get(p as i32)?;
                    let n = (page.rotation()?.as_degrees() as i32 + degrees).rem_euclid(360);
                    page.set_rotation(match n {
                        90 => PdfPageRenderRotation::Degrees90,
                        180 => PdfPageRenderRotation::Degrees180,
                        270 => PdfPageRenderRotation::Degrees270,
                        _ => PdfPageRenderRotation::None,
                    });
                }
            }
            EditCommand::DuplicatePage { page } => {
                let source = self.pdfium.load_pdf_from_byte_slice(bytes, None)?;
                doc.pages_mut()
                    .copy_page_from_document(&source, *page as i32, *page as i32 + 1)?;
            }
            EditCommand::BlankPage {
                after,
                width,
                height,
            } => {
                Rect {
                    x: 0.,
                    y: 0.,
                    width: *width,
                    height: *height,
                }
                .validate()?;
                let at = (*after as i32 + 1).min(doc.pages().len());
                doc.pages_mut()
                    .create_page_at_index(PdfPagePaperSize::Custom(pt(*width), pt(*height)), at)?;
            }
            EditCommand::Crop { pages, rect } => {
                rect.validate()?;
                for &p in pages {
                    let mut page = doc.pages().get(p as i32)?;
                    let h = page.height().value;
                    page.boundaries_mut().set_crop(rect.pdf(h))?;
                }
            }
            EditCommand::EditText {
                page,
                object,
                text,
                font: replacement,
                size,
                color: c,
            } => {
                check_text(text, *size)?;
                let replacement_font = if let Some(name) = replacement {
                    Some(font(&mut doc, name)?)
                } else {
                    None
                };
                let mut p = doc.pages().get(*page as i32)?;
                let mut obj = p.objects().get(*object)?;
                if text.is_empty() {
                    drop(obj);
                    p.objects_mut().remove_object_at_index(*object)?;
                } else if text.contains('\n') {
                    let token = replacement_font
                        .ok_or("Choose a replacement font to create multiple text lines.")?;
                    let old = obj.as_text_object().ok_or("Select a text object.")?;
                    let matrix = old.matrix()?;
                    let scale = matrix.c().hypot(matrix.d());
                    if scale < 0.0001 {
                        return fail("This text has a degenerate transform.");
                    }
                    let mut lines = Vec::new();
                    for (i, line) in text.lines().enumerate() {
                        let mut new = PdfPageTextObject::new(&doc, line, token, pt(*size / scale))?;
                        new.apply_matrix(matrix)?;
                        let step = i as f32 * *size / scale * 1.2;
                        new.translate(pt(-step * matrix.c()), pt(-step * matrix.d()))?;
                        new.set_fill_color(color(*c))?;
                        lines.push(new);
                    }
                    drop(obj);
                    p.objects_mut().remove_object_at_index(*object)?;
                    for (i, line) in lines.into_iter().enumerate() {
                        p.objects_mut()
                            .insert_object_at_index(*object + i, PdfPageObject::Text(line))?;
                    }
                } else if let Some(token) = replacement_font {
                    let old = obj.as_text_object().ok_or("Select a text object.")?;
                    let matrix = old.matrix()?;
                    let scale = matrix.c().hypot(matrix.d());
                    if scale < 0.0001 {
                        return fail("This text has a degenerate transform and cannot be resized.");
                    }
                    let mut new = PdfPageTextObject::new(&doc, text, token, pt(*size / scale))?;
                    new.apply_matrix(matrix)?;
                    new.set_fill_color(color(*c))?;
                    drop(obj);
                    p.objects_mut().remove_object_at_index(*object)?;
                    p.objects_mut()
                        .insert_object_at_index(*object, PdfPageObject::Text(new))?;
                } else {
                    let t = obj.as_text_object_mut().ok_or("Select a text object.")?;
                    if text.is_empty() {
                        drop(obj);
                        p.objects_mut().remove_object_at_index(*object)?;
                    } else {
                        // Style-only changes must not re-encode an embedded subset font.
                        let changed = t.text().trim_end() != text.trim_end();
                        if changed {
                            t.set_text(text)?;
                        }
                        let m = t.matrix()?;
                        let scale = m.c().hypot(m.d());
                        if scale < 0.0001 {
                            return fail(
                                "This text has a degenerate transform and cannot be resized.",
                            );
                        }
                        t.set_unscaled_font_size(pt(*size / scale))?;
                        t.set_fill_color(color(*c))?;
                        if changed && t.text().trim_end() != text.trim_end() {
                            return fail("This font cannot encode the replacement text. Choose a replacement font explicitly.");
                        }
                        drop(obj);
                    }
                }
                p.regenerate_content()?;
            }
            EditCommand::AddParagraph {
                page,
                rect,
                text,
                font: name,
                size,
                color: c,
            } => {
                rect.validate()?;
                check_text(text, *size)?;
                let token = font(&mut doc, name)?;
                let measure = |value: &str| -> Result<f32> {
                    Ok(PdfPageTextObject::new(&doc, value, token, pt(*size))?
                        .width()?
                        .value)
                };
                let mut lines: Vec<String> = Vec::new();
                for paragraph in text.split('\n') {
                    let mut line = String::new();
                    for word in paragraph.split_whitespace() {
                        let candidate = if line.is_empty() {
                            word.to_string()
                        } else {
                            format!("{line} {word}")
                        };
                        if !line.is_empty() && measure(&candidate)? > rect.width {
                            lines.push(std::mem::take(&mut line));
                        }
                        if !line.is_empty() {
                            line.push(' ');
                        }
                        for ch in word.chars() {
                            let candidate = format!("{line}{ch}");
                            if !line.is_empty() && measure(&candidate)? > rect.width {
                                lines.push(std::mem::take(&mut line));
                            }
                            line.push(ch);
                        }
                    }
                    lines.push(line);
                }
                let mut p = doc.pages().get(*page as i32)?;
                let h = p.height().value;
                if rect.y + lines.len() as f32 * size * 1.2 > h {
                    return fail("This paragraph extends below the page. Use a smaller size, a wider text area or another page.");
                }
                for (i, line) in lines.iter().enumerate() {
                    if line.is_empty() {
                        continue;
                    }
                    let mut o = p.objects_mut().create_text_object(
                        pt(rect.x),
                        pt(h - rect.y - *size - i as f32 * size * 1.2),
                        line,
                        token,
                        pt(*size),
                    )?;
                    o.set_fill_color(color(*c))?;
                }
            }
            EditCommand::AddText {
                page,
                rect,
                text,
                font: name,
                size,
                color: c,
            } => {
                rect.validate()?;
                check_text(text, *size)?;
                let token = font(&mut doc, name)?;
                let mut p = doc.pages().get(*page as i32)?;
                let h = p.height().value;
                for (i, line) in text.lines().enumerate() {
                    let y = h - rect.y - *size - i as f32 * size * 1.2;
                    let mut o = p.objects_mut().create_text_object(
                        pt(rect.x),
                        pt(y),
                        line,
                        token,
                        pt(*size),
                    )?;
                    o.set_fill_color(color(*c))?;
                }
            }
            EditCommand::DeleteObject { page, object } => {
                doc.pages()
                    .get(*page as i32)?
                    .objects_mut()
                    .remove_object_at_index(*object)?;
            }
            EditCommand::DuplicateObject { page, object } => {
                let p = doc.pages().get(*page as i32)?;
                let mut object = p.objects().get(*object)?;
                let mut target = doc.pages().get(*page as i32)?;
                let mut copied = object.copy_to_page(&mut target)?;
                copied.translate(pt(12.), pt(-12.))?;
            }
            EditCommand::Arrange {
                page,
                object,
                position,
            } => {
                let mut p = doc.pages().get(*page as i32)?;
                let len = p.objects().len();
                let index = match position.as_str() {
                    "front" => len - 1,
                    "back" => 0,
                    "forward" => (*object + 1).min(len - 1),
                    "backward" => object.saturating_sub(1),
                    _ => return fail("Invalid arrange position"),
                };
                let moved = p.objects_mut().remove_object_at_index(*object)?;
                p.objects_mut().insert_object_at_index(index, moved)?;
            }
            EditCommand::Transform {
                page,
                object,
                dx,
                dy,
                sx,
                sy,
                degrees,
            } => {
                if [*dx, *dy, *sx, *sy, *degrees]
                    .iter()
                    .any(|v| !v.is_finite())
                    || sx.abs() < 0.01
                    || sy.abs() < 0.01
                    || sx.abs() > 100.
                    || sy.abs() > 100.
                {
                    return fail("Invalid object transform.");
                }
                let p = doc.pages().get(*page as i32)?;
                let mut o = p.objects().get(*object)?;
                let b = o.bounds()?;
                o.translate(-b.left(), -b.bottom())?;
                o.scale(*sx, *sy)?;
                o.rotate_counter_clockwise_degrees(*degrees)?;
                o.translate(b.left() + pt(*dx), b.bottom() - pt(*dy))?;
            }
            EditCommand::Image {
                page,
                object,
                rect,
                data,
            } => {
                rect.validate()?;
                if data.len() > 100_000_000 {
                    return fail("Image exceeds the import size limit.");
                }
                let raw = STANDARD.decode(data)?;
                let mut reader = image::ImageReader::new(Cursor::new(raw)).with_guessed_format()?;
                let mut limits = image::Limits::default();
                limits.max_alloc = Some(128 * 1024 * 1024);
                reader.limits(limits);
                let img = reader.decode()?;
                let mut p = doc.pages().get(*page as i32)?;
                if let Some(index) = object {
                    let mut o = p.objects().get(*index)?;
                    o.as_image_object_mut()
                        .ok_or("Select an image object.")?
                        .set_image(&img)?;
                } else {
                    let h = p.height().value;
                    p.objects_mut().create_image_object(
                        pt(rect.x),
                        pt(h - rect.y - rect.height),
                        &img,
                        Some(pt(rect.width)),
                        Some(pt(rect.height)),
                    )?;
                }
            }
            EditCommand::Shape {
                page,
                rect,
                shape,
                color: c,
                width,
                fill,
            } => {
                rect.validate()?;
                let mut p = doc.pages().get(*page as i32)?;
                let h = p.height().value;
                let r = rect.pdf(h);
                let f = if *fill { Some(color(*c)) } else { None };
                match shape.as_str() {
                    "ellipse" => {
                        p.objects_mut().create_path_object_ellipse(
                            r,
                            Some(color(*c)),
                            Some(pt(*width)),
                            f,
                        )?;
                    }
                    "line" => {
                        p.objects_mut().create_path_object_line(
                            r.left(),
                            r.top(),
                            r.right(),
                            r.bottom(),
                            color(*c),
                            pt(*width),
                        )?;
                    }
                    "rectangle" => {
                        p.objects_mut().create_path_object_rect(
                            r,
                            Some(color(*c)),
                            Some(pt(*width)),
                            f,
                        )?;
                    }
                    _ => return fail("Unknown shape."),
                }
            }
            EditCommand::FilledMark {
                page,
                paths,
                color: c,
                width,
            } => {
                if paths.is_empty()
                    || paths.len() > 800
                    || paths.iter().map(Vec::len).sum::<usize>() > 100000
                    || !width.is_finite()
                    || *width < 0.
                    || *width > 30.
                    || paths
                        .iter()
                        .flatten()
                        .flatten()
                        .any(|v| !v.is_finite() || v.abs() > 30000.)
                {
                    return fail("Invalid vector mark.");
                }
                let mut p = doc.pages().get(*page as i32)?;
                let h = p.height().value;
                let first = paths
                    .iter()
                    .find_map(|s| s.first())
                    .ok_or("Empty vector mark")?;
                let mut path = PdfPagePathObject::new(
                    &doc,
                    pt(first[0]),
                    pt(h - first[1]),
                    Some(color(*c)),
                    Some(pt(*width)),
                    Some(color(*c)),
                )?;
                for contour in paths {
                    if contour.len() < 3 {
                        continue;
                    }
                    path.move_to(pt(contour[0][0]), pt(h - contour[0][1]))?;
                    for point in contour.iter().skip(1) {
                        path.line_to(pt(point[0]), pt(h - point[1]))?;
                    }
                    path.close_path()?;
                }
                p.objects_mut().add_path_object(path)?;
            }
            EditCommand::Signature {
                page,
                paths,
                color: c,
                width,
            }
            | EditCommand::Brush {
                page,
                paths,
                color: c,
                width,
            } => {
                if paths.is_empty()
                    || paths.len() > 200
                    || paths.iter().map(Vec::len).sum::<usize>() > 30000
                    || !width.is_finite()
                    || *width <= 0.
                    || paths.iter().flatten().flatten().any(|v| !v.is_finite())
                {
                    return fail("Invalid signature paths.");
                }
                let mut p = doc.pages().get(*page as i32)?;
                let h = p.height().value;
                let first = paths
                    .iter()
                    .find_map(|s| s.first())
                    .ok_or("Empty signature")?;
                let mut path = PdfPagePathObject::new(
                    &doc,
                    pt(first[0]),
                    pt(h - first[1]),
                    Some(color(*c)),
                    Some(pt(*width)),
                    None,
                )?;
                for points in paths {
                    if points.len() < 2 {
                        continue;
                    }
                    path.move_to(pt(points[0][0]), pt(h - points[0][1]))?;
                    for i in 0..points.len() - 1 {
                        let a = points[i.saturating_sub(1)];
                        let b = points[i];
                        let c = points[i + 1];
                        let d = points[(i + 2).min(points.len() - 1)];
                        // Repeated knots preserve sharp corners without zero-length loops.
                        if b == c {
                            continue;
                        }
                        path.bezier_to(
                            pt(c[0]),
                            pt(h - c[1]),
                            pt(b[0] + (c[0] - a[0]) / 6.),
                            pt(h - b[1] - (c[1] - a[1]) / 6.),
                            pt(c[0] - (d[0] - b[0]) / 6.),
                            pt(h - c[1] + (d[1] - b[1]) / 6.),
                        )?;
                    }
                }
                p.objects_mut().add_path_object(path)?;
            }
            EditCommand::Ink {
                page,
                points,
                color: c,
                width,
            } => {
                if points.len() < 2
                    || points.len() > 20000
                    || !width.is_finite()
                    || *width <= 0.
                    || points.iter().flatten().any(|v| !v.is_finite())
                {
                    return fail("Invalid drawing.");
                }
                let mut p = doc.pages().get(*page as i32)?;
                let h = p.height().value;
                let mut path = PdfPagePathObject::new(
                    &doc,
                    pt(points[0][0]),
                    pt(h - points[0][1]),
                    Some(color(*c)),
                    Some(pt(*width)),
                    None,
                )?;
                for point in points.iter().skip(1) {
                    path.line_to(pt(point[0]), pt(h - point[1]))?;
                }
                p.objects_mut().add_path_object(path)?;
            }
            EditCommand::Watermark {
                text,
                size,
                opacity,
                degrees,
                pages,
            } => {
                check_text(text, *size)?;
                let token = doc.fonts_mut().helvetica();
                for &index in pages {
                    let mut p = doc.pages().get(index as i32)?;
                    let (w, h) = (p.width(), p.height());
                    let mut o = p.objects_mut().create_text_object(
                        PdfPoints::ZERO,
                        PdfPoints::ZERO,
                        text,
                        token,
                        pt(*size),
                    )?;
                    o.set_fill_color(PdfColor::new(95, 105, 110, *opacity))?;
                    o.rotate_counter_clockwise_degrees(*degrees)?;
                    let b = o.bounds()?;
                    o.translate((w - b.width()) / 2., h / 2.)?;
                }
            }
            EditCommand::PageNumbers {
                prefix,
                start,
                pages,
            } => {
                let token = doc.fonts_mut().helvetica();
                for (i, &index) in pages.iter().enumerate() {
                    let mut p = doc.pages().get(index as i32)?;
                    let w = p.width();
                    p.objects_mut().create_text_object(
                        w / 2.,
                        pt(24.),
                        format!("{}{}", prefix, *start + i as u32),
                        token,
                        pt(10.),
                    )?;
                }
            }
            EditCommand::Ocr { page, words } => {
                if words.len() > 20000 {
                    return fail("OCR word count exceeds the page limit.");
                }
                let token = doc.fonts_mut().load_true_type_from_bytes(
                    include_bytes!("../../../assets/fonts/NotoSans-Regular.ttf"),
                    true,
                )?;
                let mut p = doc.pages().get(*page as i32)?;
                let h = p.height().value;
                for word in words {
                    word.rect.validate()?;
                    check_text(&word.text, word.rect.height.clamp(1., 500.))?;
                    let mut text =
                        PdfPageTextObject::new(&doc, &word.text, token, pt(word.rect.height))?;
                    let width = text.bounds()?.width().value;
                    if width > 0. {
                        text.scale(word.rect.width / width, 1.)?;
                    }
                    text.translate(
                        pt(word.rect.x),
                        pt(h - word.rect.y - word.rect.height * 0.9),
                    )?;
                    text.set_render_mode(PdfPageTextRenderMode::Invisible)?;
                    p.objects_mut().add_text_object(text)?;
                }
            }
            _ => return fail("Command routing error."),
        }
        let output = doc.save_to_bytes()?;
        self.info(&output)?;
        Ok(output)
    }
}
