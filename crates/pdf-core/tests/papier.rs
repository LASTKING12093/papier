use pdf_core::{
    engine::{EditCommand, PdfEngine},
    workspace::Workspace,
};
use serde_json::json;
use std::path::PathBuf;
fn root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..")
}
#[test]
fn reconstructed_rectangle_preserves_corner_bounds() {
    let engine = PdfEngine::new(&root().join("vendor/pdfium/bin/pdfium.dll")).unwrap();
    let points: Vec<[f32; 2]> = [
        [80., 100.],
        [280., 100.],
        [280., 220.],
        [80., 220.],
        [80., 100.],
    ]
    .iter()
    .flat_map(|p| [*p, *p, *p])
    .collect();
    let bytes = engine
        .edit(
            &engine.create().unwrap(),
            &EditCommand::Signature {
                page: 0,
                paths: vec![points],
                color: [20, 20, 20, 255],
                width: 1.,
            },
        )
        .unwrap();
    let objects = engine.inspect(&bytes, 0).unwrap();
    assert_eq!(objects.len(), 1);
    assert_eq!(objects[0].kind, "path");
    // PDFium includes a stroke-width margin on both sides.
    assert!((objects[0].bounds.width - 202.).abs() < 0.1);
    assert!((objects[0].bounds.height - 122.).abs() < 0.1);
}
#[test]
fn resized_rotated_text_keeps_effective_size_when_styled() {
    let engine = PdfEngine::new(&root().join("vendor/pdfium/bin/pdfium.dll")).unwrap();
    let bytes = std::fs::read(root().join("tests/fixtures/studio-brief.pdf")).unwrap();
    let objects = engine.inspect(&bytes, 0).unwrap();
    let original = objects
        .iter()
        .find(|o| o.text.as_deref() == Some("A considered"))
        .unwrap();
    let resized = engine
        .edit(
            &bytes,
            &EditCommand::Transform {
                page: 0,
                object: original.index,
                dx: 40.,
                dy: 20.,
                sx: 1.5,
                sy: 1.5,
                degrees: 30.,
            },
        )
        .unwrap();
    let after = engine.inspect(&resized, 0).unwrap();
    assert!((after[original.index].size.unwrap() - original.size.unwrap() * 1.5).abs() < 0.1);
    for replacement in [None, Some("Manrope".to_string())] {
        let styled = engine
            .edit(
                &resized,
                &EditCommand::EditText {
                    page: 0,
                    object: original.index,
                    text: original.text.clone().unwrap(),
                    font: replacement,
                    size: 28.,
                    color: [31, 98, 207, 255],
                },
            )
            .unwrap();
        let result = engine.inspect(&styled, 0).unwrap();
        assert!((result[original.index].size.unwrap() - 28.).abs() < 0.1);
        assert_eq!(result[original.index].color, [31, 98, 207, 255]);
        assert_eq!(result[original.index].text, original.text);
    }
}
#[test]
fn vector_signature_clipboard_insertion_and_recent_roundtrip() {
    let dir = tempfile::tempdir().unwrap();
    let library = root().join("vendor/pdfium/bin/pdfium.dll");
    let engine = PdfEngine::new(&library).unwrap();
    let mut bytes = engine.create_sized(612., 792., 1).unwrap();
    bytes = engine
        .edit(
            &bytes,
            &EditCommand::AddText {
                page: 0,
                rect: pdf_core::engine::Rect {
                    x: 72.,
                    y: 80.,
                    width: 300.,
                    height: 30.,
                },
                text: "Papier editable template".into(),
                font: "Helvetica".into(),
                size: 14.,
                color: [20, 20, 20, 255],
            },
        )
        .unwrap();
    bytes = engine
        .edit(
            &bytes,
            &EditCommand::Signature {
                page: 0,
                paths: vec![
                    vec![
                        [72., 160.],
                        [82., 140.],
                        [92., 175.],
                        [120., 153.],
                        [160., 164.],
                    ],
                    vec![[70., 182.], [172., 179.]],
                ],
                color: [20, 20, 20, 255],
                width: 1.2,
            },
        )
        .unwrap();
    let original = engine.inspect(&bytes, 0).unwrap();
    assert_eq!(original.len(), 2);
    assert_eq!(original[1].kind, "path");
    let duplicated = engine
        .edit(&bytes, &EditCommand::DuplicateObject { page: 0, object: 1 })
        .unwrap();
    assert_eq!(engine.inspect(&duplicated, 0).unwrap().len(), 3);
    let arranged = engine
        .edit(
            &duplicated,
            &EditCommand::Arrange {
                page: 0,
                object: 2,
                position: "back".into(),
            },
        )
        .unwrap();
    assert_eq!(engine.inspect(&arranged, 0).unwrap().len(), 3);
    let copied = engine.copy_object(&bytes, 0, 0).unwrap();
    let pasted = engine
        .paste_object(&engine.create().unwrap(), &copied, 0)
        .unwrap();
    assert!(engine.text(&pasted).unwrap()[0].contains("Papier editable template"));
    let inserted = engine.insert(&bytes, &pasted, 0).unwrap();
    assert_eq!(engine.info(&inserted).unwrap().pages.len(), 2);
    let file = dir.path().join("Papier.pdf");
    pdf_core::session::atomic_write(&file, &inserted).unwrap();
    let mut w = Workspace::new(&library, dir.path().join("recovery")).unwrap();
    let s = w
        .dispatch(json!({"action":"open","payload":{"path":file}}))
        .unwrap();
    assert_eq!(s["info"]["pages"].as_array().unwrap().len(), 2);
    let recent = w.dispatch(json!({"action":"recent_list"})).unwrap();
    assert_eq!(recent.as_array().unwrap().len(), 1);
    assert!(recent[0]["thumbnail"]
        .as_str()
        .unwrap()
        .starts_with("data:image/png;base64,"));
    let id = recent[0]["id"].as_str().unwrap();
    let sessions_before = w.dispatch(json!({"action":"sessions"})).unwrap();
    let preview = w
        .dispatch(json!({"action":"recent_preview","id":id}))
        .unwrap();
    assert!(preview
        .as_str()
        .unwrap()
        .starts_with("data:image/png;base64,"));
    assert_eq!(
        w.dispatch(json!({"action":"sessions"})).unwrap(),
        sessions_before
    );
    assert_eq!(w.dispatch(json!({"action":"recent_list"})).unwrap(), recent);
    assert!(w
        .dispatch(json!({"action":"recent_preview","id":"missing"}))
        .is_err());
    w.dispatch(json!({"action":"recent_pin","id":id})).unwrap();
    drop(w);
    let mut w = Workspace::new(&library, dir.path().join("recovery")).unwrap();
    let reopened = w.dispatch(json!({"action":"recent_open","id":id})).unwrap();
    assert_eq!(reopened["info"]["pages"].as_array().unwrap().len(), 2);
    assert_eq!(
        w.dispatch(json!({"action":"recent_list"})).unwrap()[0]["pinned"],
        true
    );
    w.dispatch(json!({"action":"recent_remove","id":id}))
        .unwrap();
    assert!(file.exists());
}

#[test]
fn embedded_text_style_and_compositing_are_real() {
    use base64::{engine::general_purpose::STANDARD, Engine as _};
    use pdf_core::engine::{EditCommand, PdfEngine};
    let engine = PdfEngine::new(&root().join("vendor/pdfium/bin/pdfium.dll")).unwrap();
    let bytes = std::fs::read(root().join("tests/fixtures/studio-brief.pdf")).unwrap();
    let objects = engine.inspect(&bytes, 0).unwrap();
    let object = objects
        .iter()
        .find(|o| o.text.as_deref() == Some("A considered"))
        .unwrap();
    let changed = engine
        .edit(
            &bytes,
            &EditCommand::EditText {
                page: 0,
                object: object.index,
                text: object.text.clone().unwrap(),
                font: None,
                size: 44.,
                color: [31, 98, 207, 255],
            },
        )
        .unwrap();
    let after = engine.inspect(&changed, 0).unwrap();
    assert_eq!(after[object.index].text, object.text);
    assert_eq!(after[object.index].color, [31, 98, 207, 255]);
    assert!((after[object.index].size.unwrap() - 44.).abs() < 0.1);
    let replaced = engine
        .edit(
            &changed,
            &EditCommand::EditText {
                page: 0,
                object: object.index,
                text: "Papier precision".into(),
                font: Some("Noto Sans".into()),
                size: 32.,
                color: [87, 34, 183, 255],
            },
        )
        .unwrap();
    let after = engine.inspect(&replaced, 0).unwrap();
    assert_eq!(
        after[object.index].text.as_deref(),
        Some("Papier precision")
    );
    assert_eq!(after.len(), objects.len());
    for font in [
        "Manrope",
        "Noto Serif",
        "Noto Serif Italic",
        "Roboto Mono",
        "Cormorant Garamond",
        "Caveat",
    ] {
        let result = engine
            .edit(
                &bytes,
                &EditCommand::EditText {
                    page: 0,
                    object: object.index,
                    text: "Papier · João · précision".into(),
                    font: Some(font.into()),
                    size: 24.,
                    color: [20, 40, 60, 255],
                },
            )
            .unwrap();
        let result = engine.inspect(&result, 0).unwrap();
        assert_eq!(
            result[object.index].text.as_deref(),
            Some("Papier · João · précision"),
            "Font roundtrip failed: {font}"
        );
        assert_eq!(result[object.index].color, [20, 40, 60, 255]);
    }
    let layers = engine.object_layers(&bytes, 0, object.index, 900).unwrap();
    let images: Vec<_> = layers
        .iter()
        .map(|s| {
            image::load_from_memory(&STANDARD.decode(s.split(',').nth(1).unwrap()).unwrap())
                .unwrap()
                .to_rgba8()
        })
        .collect();
    assert!(images[1].pixels().any(|p| p[3] == 0));
    assert!(images[1].pixels().any(|p| p[3] > 100));
    let mut composite = images[0].clone();
    image::imageops::overlay(&mut composite, &images[1], 0, 0);
    image::imageops::overlay(&mut composite, &images[2], 0, 0);
    let full = image::load_from_memory(&engine.render(&bytes, 0, 900).unwrap())
        .unwrap()
        .to_rgba8();
    let delta: u64 = composite
        .pixels()
        .zip(full.pixels())
        .map(|(a, b)| {
            a.0.iter()
                .zip(b.0.iter())
                .map(|(a, b)| (*a as i32 - *b as i32).unsigned_abs() as u64)
                .sum::<u64>()
        })
        .sum();
    assert!(
        delta < (full.width() * full.height()) as u64 * 2,
        "Layer compositing changed the actual page: {delta}"
    );
    assert_eq!(
        engine.inspect(&bytes, 0).unwrap()[object.index].text,
        object.text
    );
}
