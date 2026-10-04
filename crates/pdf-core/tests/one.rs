use pdf_core::{
    engine::{EditCommand, PdfEngine, Rect},
    workspace::Workspace,
};
use serde_json::json;
fn engine() -> PdfEngine {
    PdfEngine::new(
        &std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../vendor/pdfium/bin/pdfium.dll"),
    )
    .unwrap()
}
#[test]
fn paragraphs_wrap_with_actual_font_metrics_and_reject_overflow() {
    let e = engine();
    let original = e.create().unwrap();
    let result=e.edit(&original,&EditCommand::AddParagraph{page:0,rect:Rect{x:70.,y:100.,width:140.,height:50.},text:"A paragraph with deliberate wrapping and a verylongwordthatmustalsobreakwithinitswidth".into(),font:"Noto Sans".into(),size:14.,color:[0,0,0,255]}).unwrap();
    let objects = e.inspect(&result, 0).unwrap();
    assert!(objects.len() > 3);
    for o in &objects {
        assert!(o.bounds.width < 141.);
    }
    assert!(e
        .edit(
            &original,
            &EditCommand::AddParagraph {
                page: 0,
                rect: Rect {
                    x: 70.,
                    y: 810.,
                    width: 140.,
                    height: 50.
                },
                text: "Too much text for the bottom of this page".into(),
                font: "Noto Sans".into(),
                size: 24.,
                color: [0, 0, 0, 255]
            }
        )
        .is_err());
}
#[test]
fn multiline_replacement_and_empty_replacement_keep_other_objects() {
    let e = engine();
    let b = e
        .edit(
            &e.create().unwrap(),
            &EditCommand::AddText {
                page: 0,
                rect: Rect {
                    x: 70.,
                    y: 100.,
                    width: 300.,
                    height: 50.,
                },
                text: "First".into(),
                font: "Noto Sans".into(),
                size: 14.,
                color: [0, 0, 0, 255],
            },
        )
        .unwrap();
    let b = e
        .edit(
            &b,
            &EditCommand::EditText {
                page: 0,
                object: 0,
                text: "Line one\nLine two".into(),
                font: Some("Noto Sans".into()),
                size: 16.,
                color: [21, 31, 41, 255],
            },
        )
        .unwrap();
    let o = e.inspect(&b, 0).unwrap();
    assert_eq!(o.len(), 2);
    assert!((o[1].bounds.y - o[0].bounds.y - 19.2).abs() < 0.2);
    let b = e
        .edit(
            &b,
            &EditCommand::EditText {
                page: 0,
                object: 0,
                text: "".into(),
                font: Some("Noto Sans".into()),
                size: 16.,
                color: [0, 0, 0, 255],
            },
        )
        .unwrap();
    assert_eq!(e.inspect(&b, 0).unwrap().len(), 1);
    assert!(e.text(&b).unwrap()[0].contains("Line two"));
}
#[test]
fn filled_marks_roundtrip_and_failed_batches_do_not_commit() {
    let dir = tempfile::tempdir().unwrap();
    let lib =
        std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../vendor/pdfium/bin/pdfium.dll");
    let mut w = Workspace::new(&lib, dir.path().to_path_buf()).unwrap();
    let s = w.dispatch(json!({"action":"create"})).unwrap();
    let id = s["id"].as_str().unwrap();
    let command = json!({"kind":"filled_mark","page":0,"paths":[[[70,80],[170,80],[170,180],[70,180]],[[90,100],[90,160],[150,160],[150,100]]],"width":0.1,"color":[10,20,30,255]});
    let next = w
        .dispatch(json!({"action":"edit","id":id,"payload":{"revision":0,"command":command}}))
        .unwrap();
    assert_eq!(
        w.dispatch(json!({"action":"inspect","id":id,"payload":{"page":0}}))
            .unwrap()[0]["kind"],
        "path"
    );
    assert!(w.dispatch(json!({"action":"edit_batch","id":id,"payload":{"revision":next["revision"],"commands":[{"kind":"delete_object","page":0,"object":0},{"kind":"delete_object","page":0,"object":999}]}})).is_err());
    assert_eq!(
        w.dispatch(json!({"action":"view","id":id})).unwrap()["revision"],
        next["revision"]
    );
}
