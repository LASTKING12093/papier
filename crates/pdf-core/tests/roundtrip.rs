use pdf_core::{
    engine::{EditCommand, PdfEngine, Rect},
    structure,
};
use std::path::PathBuf;
fn root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..")
}
fn engine() -> PdfEngine {
    PdfEngine::new(&root().join("vendor/pdfium/bin/pdfium.dll")).unwrap()
}
fn fixture() -> Vec<u8> {
    std::fs::read(root().join("tests/fixtures/studio-brief.pdf")).unwrap()
}
#[test]
fn real_pdf_roundtrip() {
    let e = engine();
    let bytes = fixture();
    assert_eq!(e.info(&bytes).unwrap().pages.len(), 3);
    let objects = e.inspect(&bytes, 0).unwrap();
    let object = objects
        .iter()
        .find(|o| o.text.as_deref() == Some("A considered"))
        .unwrap();
    let changed = e
        .edit(
            &bytes,
            &EditCommand::EditText {
                page: 0,
                object: object.index,
                text: "A better".into(),
                font: Some("Helvetica-Bold".into()),
                size: 38.,
                color: [40, 60, 40, 255],
            },
        )
        .unwrap();
    let text = e.text(&changed).unwrap();
    assert!(text[0].contains("A better"));
    assert!(!text[0].contains("A considered"));
    assert!(e
        .inspect(&changed, 0)
        .unwrap()
        .iter()
        .any(|o| o.text.as_deref() == Some("A better")));
    let reordered = e
        .edit(
            &changed,
            &EditCommand::Reorder {
                order: vec![2, 0, 1],
            },
        )
        .unwrap();
    assert!(e.text(&reordered).unwrap()[0].contains("SECRET_ABC_123"));
    let cropped = e
        .edit(
            &reordered,
            &EditCommand::Crop {
                pages: vec![0],
                rect: Rect {
                    x: 0.,
                    y: 0.,
                    width: 300.,
                    height: 400.,
                },
            },
        )
        .unwrap();
    assert!((e.info(&cropped).unwrap().pages[0].width - 300.).abs() < 1.);
    let split = e.extract(&changed, &[1]).unwrap();
    assert_eq!(e.info(&split).unwrap().pages.len(), 1);
    let merged = e.merge(&split, &changed).unwrap();
    assert_eq!(e.info(&merged).unwrap().pages.len(), 4);
    let rotated = e
        .edit(
            &bytes,
            &EditCommand::Rotate {
                pages: vec![0],
                degrees: 90,
            },
        )
        .unwrap();
    assert!((e.info(&rotated).unwrap().pages[0].width - 841.89).abs() < 1.);
    let metadata = e
        .edit(
            &bytes,
            &EditCommand::Metadata {
                values: [("Title".into(), "Changed title".into())].into(),
            },
        )
        .unwrap();
    assert_eq!(
        e.render(&bytes, 0, 800).unwrap(),
        e.render(&metadata, 0, 800).unwrap(),
        "metadata must not change rendered pixels"
    );
    let optimized = e.edit(&bytes, &EditCommand::Compress).unwrap();
    assert_eq!(
        e.render(&bytes, 0, 800).unwrap(),
        e.render(&optimized, 0, 800).unwrap()
    );
    std::fs::create_dir_all(root().join("tmp/qa")).unwrap();
    std::fs::write(
        root().join("tmp/qa/edited.png"),
        e.render(&changed, 0, 800).unwrap(),
    )
    .unwrap();
    std::fs::write(root().join("tmp/qa/edited.pdf"), &changed).unwrap();
}
#[test]
fn forms_annotations_and_redaction() {
    let e = engine();
    let bytes = fixture();
    let field = e
        .edit(
            &bytes,
            &EditCommand::Field {
                page: 0,
                rect: Rect {
                    x: 55.,
                    y: 70.,
                    width: 150.,
                    height: 25.,
                },
                name: "test_field".into(),
                field_type: "text".into(),
                value: "Initial".into(),
                required: true,
            },
        )
        .unwrap();
    let filled = e
        .edit(
            &field,
            &EditCommand::FillField {
                name: "test_field".into(),
                value: "Verified".into(),
            },
        )
        .unwrap();
    let props = structure::properties(&filled).unwrap();
    assert!(props["fields"]
        .as_array()
        .unwrap()
        .iter()
        .any(|v| v["name"] == "test_field" && v["value"] == "Verified"));
    let flattened = e.edit(&filled, &EditCommand::FlattenForms).unwrap();
    assert!(structure::properties(&flattened).unwrap()["fields"]
        .as_array()
        .unwrap()
        .is_empty());
    assert!(e.text(&flattened).unwrap()[0].contains("Verified"));
    let annotated = e
        .edit(
            &bytes,
            &EditCommand::Annotation {
                page: 0,
                rect: Rect {
                    x: 50.,
                    y: 150.,
                    width: 200.,
                    height: 30.,
                },
                subtype: "Highlight".into(),
                text: "Reviewed".into(),
                color: [255, 220, 0, 140],
            },
        )
        .unwrap();
    assert_ne!(
        e.render(&bytes, 0, 500).unwrap(),
        e.render(&annotated, 0, 500).unwrap()
    );
    let redacted = e
        .redact(
            &bytes,
            2,
            &Rect {
                x: 45.,
                y: 80.,
                width: 280.,
                height: 60.,
            },
        )
        .unwrap();
    assert!(e
        .text(&redacted)
        .unwrap()
        .iter()
        .all(|s| s.trim().is_empty()));
    let mut d = lopdf::Document::load_mem(&redacted).unwrap();
    d.decompress();
    let mut expanded = Vec::new();
    d.save_to(&mut expanded).unwrap();
    assert!(!expanded.windows(14).any(|w| w == b"SECRET_ABC_123"));
    let pixels = image::load_from_memory(&e.render(&redacted, 2, 595).unwrap())
        .unwrap()
        .to_rgb8();
    assert_eq!(pixels.get_pixel(60, 100).0, [0, 0, 0]);
}
#[test]
fn hostile_input_and_bounds() {
    let e = engine();
    assert!(e.info(b"not a PDF").is_err());
    let b = fixture();
    assert!(e.render(&b, 400, 800).is_err());
    assert!(e.render(&b, 0, 100000).is_err());
    assert!(e
        .edit(
            &b,
            &EditCommand::Reorder {
                order: vec![0, 0, 1]
            }
        )
        .is_err());
    assert!(e
        .edit(
            &b,
            &EditCommand::DeletePages {
                pages: vec![0, 1, 2]
            }
        )
        .is_err());
}
