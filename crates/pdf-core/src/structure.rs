use crate::{
    engine::{EditCommand, Rect},
    fail, Result,
};
use lopdf::{dictionary, Dictionary, Document, Object, ObjectId, Stream};
use serde_json::{json, Value};
use std::collections::BTreeMap;

fn root_id(d: &Document) -> Result<ObjectId> {
    Ok(d.trailer.get(b"Root")?.as_reference()?)
}
fn string(o: &Object) -> String {
    match o {
        Object::String(v, _) => {
            if v.starts_with(&[254, 255]) {
                String::from_utf16_lossy(
                    &v[2..]
                        .as_chunks::<2>()
                        .0
                        .iter()
                        .map(|c| u16::from_be_bytes([c[0], c[1]]))
                        .collect::<Vec<_>>(),
                )
            } else {
                String::from_utf8_lossy(v).into_owned()
            }
        }
        Object::Name(v) => String::from_utf8_lossy(v).into_owned(),
        _ => String::new(),
    }
}
fn pdf_string(s: &str) -> Object {
    let mut b = vec![254, 255];
    for c in s.encode_utf16() {
        b.extend(c.to_be_bytes());
    }
    Object::String(b, lopdf::StringFormat::Hexadecimal)
}
fn escape(s: &str) -> String {
    s.chars()
        .map(|c| match c {
            '(' => "\\(".into(),
            ')' => "\\)".into(),
            '\\' => "\\\\".into(),
            c if c as u32 >= 32 && c as u32 <= 126 => c.to_string(),
            _ => "?".into(),
        })
        .collect()
}
fn resolve<'a>(d: &'a Document, o: &'a Object) -> Result<&'a Object> {
    if let Ok(id) = o.as_reference() {
        Ok(d.get_object(id)?)
    } else {
        Ok(o)
    }
}
fn page_id(d: &Document, index: u16) -> Result<ObjectId> {
    d.get_pages()
        .get(&(index as u32 + 1))
        .copied()
        .ok_or_else(|| "Page does not exist.".into())
}
fn inherited(d: &Document, id: ObjectId, key: &[u8]) -> Result<Object> {
    let mut id = id;
    for _ in 0..64 {
        let p = d.get_object(id)?.as_dict()?;
        if let Ok(v) = p.get(key) {
            return Ok(resolve(d, v)?.clone());
        }
        id = p.get(b"Parent")?.as_reference()?;
    }
    fail("Page tree is too deep.")
}
fn page_height(d: &Document, id: ObjectId) -> Result<f32> {
    let box_ = inherited(d, id, b"MediaBox")?;
    let a = box_.as_array()?;
    Ok(a[3].as_float()? - a[1].as_float()?)
}
fn rectangle(r: &Rect, h: f32) -> Vec<Object> {
    vec![
        r.x.into(),
        (h - r.y - r.height).into(),
        (r.x + r.width).into(),
        (h - r.y).into(),
    ]
}
fn append_annotation(
    d: &mut Document,
    page: ObjectId,
    mut annotation: Dictionary,
) -> Result<ObjectId> {
    annotation.set("P", page);
    let id = d.add_object(annotation);
    let mut list = d
        .get_object(page)?
        .as_dict()?
        .get(b"Annots")
        .ok()
        .and_then(|o| resolve(d, o).ok())
        .and_then(|o| o.as_array().ok())
        .cloned()
        .unwrap_or_default();
    list.push(id.into());
    d.get_object_mut(page)?.as_dict_mut()?.set("Annots", list);
    Ok(id)
}
fn field_tree(d: &Document) -> Result<(Option<ObjectId>, Dictionary)> {
    let root = d.get_object(root_id(d)?)?.as_dict()?;
    if let Ok(o) = root.get(b"AcroForm") {
        Ok((o.as_reference().ok(), resolve(d, o)?.as_dict()?.clone()))
    } else {
        Ok((None, Dictionary::new()))
    }
}
fn commit_form(d: &mut Document, form: Dictionary) -> Result<()> {
    let root = root_id(d)?;
    let id = d.add_object(form);
    d.get_object_mut(root)?.as_dict_mut()?.set("AcroForm", id);
    Ok(())
}
fn appearance(d: &mut Document, w: f32, h: f32, text: &str, checked: bool) -> ObjectId {
    let font =
        d.add_object(dictionary! {"Type"=>"Font","Subtype"=>"Type1","BaseFont"=>"Helvetica"});
    let content = if checked {
        format!(
            "q 0.12 0.35 0.3 RG 2 w 3 {} m {} 3 l {} {} l S Q",
            h / 2.,
            w / 2.,
            w - 3.,
            h - 3.
        )
    } else {
        format!("q 0.25 0.3 0.3 RG 0.6 w 0.3 0.3 {} {} re S BT /F1 11 Tf 0.12 0.14 0.14 rg 4 {} Td ({}) Tj ET Q",w-0.6,h-0.6,(h-11.)/2.,escape(text))
    };
    d.add_object(Stream::new(dictionary!{"Type"=>"XObject","Subtype"=>"Form","BBox"=>vec![0.into(),0.into(),w.into(),h.into()],"Resources"=>dictionary!{"Font"=>dictionary!{"F1"=>font}}},content.into_bytes()))
}
pub fn properties(bytes: &[u8]) -> Result<Value> {
    let d = Document::load_mem(bytes)?;
    let mut metadata = BTreeMap::new();
    if let Ok(id) = d.trailer.get(b"Info").and_then(Object::as_reference) {
        if let Ok(info) = d.get_dictionary(id) {
            for (k, v) in info.iter() {
                metadata.insert(String::from_utf8_lossy(k).into_owned(), string(v));
            }
        }
    }
    let root = d.get_dictionary(root_id(&d)?)?;
    let mut bookmarks = Vec::new();
    if let Ok(outline) = root
        .get(b"Outlines")
        .and_then(Object::as_reference)
        .and_then(|id| d.get_dictionary(id))
    {
        let mut next = outline.get(b"First").and_then(Object::as_reference).ok();
        let mut visited = std::collections::HashSet::new();
        while let Some(id) = next {
            if !visited.insert(id) || visited.len() > 10000 {
                break;
            }
            let item = d.get_dictionary(id)?;
            let target = item
                .get(b"Dest")
                .ok()
                .and_then(|o| o.as_array().ok())
                .and_then(|a| a.first())
                .and_then(|o| o.as_reference().ok());
            let p = d
                .get_pages()
                .iter()
                .find(|(_, v)| Some(**v) == target)
                .map(|(p, _)| p - 1);
            bookmarks
                .push(json!({"title":item.get(b"Title").map(string).unwrap_or_default(),"page":p}));
            next = item.get(b"Next").and_then(Object::as_reference).ok();
        }
    }
    let mut annotations = Vec::new();
    let mut fields = Vec::new();
    for (number, id) in d.get_pages() {
        let p = d.get_dictionary(id)?;
        if let Some(a) = p
            .get(b"Annots")
            .ok()
            .and_then(|o| resolve(&d, o).ok())
            .and_then(|o| o.as_array().ok())
        {
            for (index, o) in a.iter().enumerate() {
                if let Ok(a) = resolve(&d, o).and_then(|o| Ok(o.as_dict()?)) {
                    let subtype = a.get(b"Subtype").map(string).unwrap_or_default();
                    let value = json!({"page":number-1,"index":index,"subtype":subtype,"text":a.get(b"Contents").map(string).unwrap_or_default(),"name":a.get(b"T").map(string).unwrap_or_default(),"value":a.get(b"V").map(string).unwrap_or_default(),"fieldType":a.get(b"FT").map(string).unwrap_or_default()});
                    if subtype == "Widget" {
                        fields.push(value);
                    } else {
                        annotations.push(value);
                    }
                }
            }
        }
    }
    Ok(
        json!({"version":d.version,"info":metadata,"bookmarks":bookmarks,"annotations":annotations,"fields":fields,"tagged":root.has(b"StructTreeRoot"),"encrypted":d.is_encrypted()}),
    )
}
pub fn edit(bytes: &[u8], cmd: &EditCommand) -> Result<Vec<u8>> {
    let mut d = Document::load_mem(bytes)?;
    match cmd {
        EditCommand::Reorder { order } => {
            let pages = d.get_pages();
            let set: std::collections::HashSet<_> = order.iter().collect();
            if order.len() != pages.len() || set.len() != pages.len() {
                return fail("Page order must contain every page exactly once.");
            }
            let root = root_id(&d)?;
            let page_root = d.get_dictionary(root)?.get(b"Pages")?.as_reference()?;
            let mut kids = Vec::new();
            for &index in order {
                let id = page_id(&d, index)?;
                for key in [b"Resources".as_slice(), b"MediaBox", b"CropBox", b"Rotate"] {
                    if let Ok(value) = inherited(&d, id, key) {
                        d.get_object_mut(id)?.as_dict_mut()?.set(key, value);
                    }
                }
                d.get_object_mut(id)?
                    .as_dict_mut()?
                    .set("Parent", page_root);
                kids.push(id.into());
            }
            d.objects.insert(
                page_root,
                Object::Dictionary(
                    dictionary! {"Type"=>"Pages","Kids"=>kids,"Count"=>pages.len() as i64},
                ),
            );
        }
        EditCommand::DeletePages { pages } => {
            let unique: std::collections::HashSet<_> = pages.iter().collect();
            if unique.len() >= d.get_pages().len() {
                return fail("Keep at least one page in the document.");
            }
            for &p in pages {
                page_id(&d, p)?;
            }
            d.delete_pages(&pages.iter().map(|p| *p as u32 + 1).collect::<Vec<_>>());
        }
        EditCommand::Metadata { values } => {
            let mut info = Dictionary::new();
            for (k, v) in values {
                if ![
                    "Title",
                    "Author",
                    "Subject",
                    "Keywords",
                    "Creator",
                    "Producer",
                    "CreationDate",
                    "ModDate",
                ]
                .contains(&k.as_str())
                {
                    return fail("Unknown metadata field.");
                }
                info.set(k.as_bytes(), pdf_string(v));
            }
            let id = d.add_object(info);
            d.trailer.set("Info", id);
        }
        EditCommand::Sanitize => {
            d.trailer.remove(b"Info");
            let root = root_id(&d)?;
            for object in d.objects.values_mut() {
                if let Ok(dict) = object.as_dict_mut() {
                    for key in [
                        b"Metadata".as_slice(),
                        b"AA",
                        b"OpenAction",
                        b"JS",
                        b"JavaScript",
                        b"EmbeddedFiles",
                        b"AF",
                        b"PieceInfo",
                        b"Thumb",
                    ] {
                        dict.remove(key);
                    }
                    if dict
                        .get(b"S")
                        .and_then(Object::as_name)
                        .is_ok_and(|s| [b"JavaScript".as_slice(), b"Launch", b"GoToR"].contains(&s))
                    {
                        dict.remove(b"S");
                        dict.remove(b"F");
                    }
                }
            }
            for id in d.get_pages().values() {
                d.get_object_mut(*id)?.as_dict_mut()?.remove(b"Annots");
            }
            let catalog = d.get_object_mut(root)?.as_dict_mut()?;
            catalog.remove(b"AcroForm");
            catalog.remove(b"Names");
            catalog.remove(b"Outlines");
        }
        EditCommand::Compress => {
            d.prune_objects();
            d.compress();
        }
        EditCommand::Annotation {
            page,
            rect,
            subtype,
            text,
            color,
        } => {
            rect.validate()?;
            if ![
                "Highlight",
                "Underline",
                "StrikeOut",
                "Squiggly",
                "Text",
                "FreeText",
                "Square",
                "Circle",
            ]
            .contains(&subtype.as_str())
            {
                return fail("Unsupported annotation type.");
            }
            let id = page_id(&d, *page)?;
            let h = page_height(&d, id)?;
            let rgb = vec![
                (color[0] as f32 / 255.).into(),
                (color[1] as f32 / 255.).into(),
                (color[2] as f32 / 255.).into(),
            ];
            let mut annotation = dictionary! {"Type"=>"Annot","Subtype"=>Object::Name(subtype.as_bytes().to_vec()),"Rect"=>rectangle(rect,h),"Contents"=>pdf_string(text),"T"=>pdf_string("Local user"),"C"=>rgb,"CA"=>color[3] as f32/255.,"F"=>4};
            if ["Highlight", "Underline", "StrikeOut", "Squiggly"].contains(&subtype.as_str()) {
                annotation.set(
                    "QuadPoints",
                    vec![
                        rect.x.into(),
                        (h - rect.y).into(),
                        (rect.x + rect.width).into(),
                        (h - rect.y).into(),
                        rect.x.into(),
                        (h - rect.y - rect.height).into(),
                        (rect.x + rect.width).into(),
                        (h - rect.y - rect.height).into(),
                    ],
                );
            }
            if subtype == "FreeText" {
                let ap = appearance(&mut d, rect.width, rect.height, text, false);
                annotation.set("AP", dictionary! {"N"=>ap});
                annotation.set("DA", Object::string_literal("/Helv 11 Tf 0 g"));
            }
            append_annotation(&mut d, id, annotation)?;
        }
        EditCommand::DeleteAnnotation { page, index } => {
            let id = page_id(&d, *page)?;
            let mut a = resolve(&d, d.get_dictionary(id)?.get(b"Annots")?)?
                .as_array()?
                .clone();
            if *index >= a.len() {
                return fail("Annotation no longer exists.");
            }
            a.remove(*index);
            d.get_object_mut(id)?.as_dict_mut()?.set("Annots", a);
        }
        EditCommand::Link { page, rect, url } => {
            rect.validate()?;
            if !url.starts_with("https://") && !url.starts_with("http://") {
                return fail("Links must begin with https:// or http://.");
            }
            let id = page_id(&d, *page)?;
            let h = page_height(&d, id)?;
            append_annotation(
                &mut d,
                id,
                dictionary! {"Type"=>"Annot","Subtype"=>"Link","Rect"=>rectangle(rect,h),"Border"=>vec![0.into(),0.into(),0.into()],"A"=>dictionary!{"S"=>"URI","URI"=>Object::string_literal(url.as_str())}},
            )?;
        }
        EditCommand::Bookmark { title, page } => {
            let target = page_id(&d, *page)?;
            let root = root_id(&d)?;
            let outlines = if let Ok(id) = d
                .get_dictionary(root)?
                .get(b"Outlines")
                .and_then(Object::as_reference)
            {
                id
            } else {
                let id = d.add_object(dictionary! {"Type"=>"Outlines","Count"=>0});
                d.get_object_mut(root)?.as_dict_mut()?.set("Outlines", id);
                id
            };
            let last = d
                .get_dictionary(outlines)?
                .get(b"Last")
                .and_then(Object::as_reference)
                .ok();
            let mut item = dictionary! {"Title"=>pdf_string(title),"Parent"=>outlines,"Dest"=>vec![target.into(),Object::Name(b"Fit".to_vec())]};
            if let Some(last) = last {
                item.set("Prev", last);
            }
            let id = d.add_object(item);
            if let Some(last) = last {
                d.get_object_mut(last)?.as_dict_mut()?.set("Next", id);
            }
            let o = d.get_object_mut(outlines)?.as_dict_mut()?;
            if last.is_none() {
                o.set("First", id);
            }
            o.set("Last", id);
            let n = o.get(b"Count").and_then(Object::as_i64).unwrap_or(0);
            o.set("Count", n + 1);
        }
        EditCommand::DeleteBookmark { index } => {
            let root = root_id(&d)?;
            let outlines = d.get_dictionary(root)?.get(b"Outlines")?.as_reference()?;
            let mut id = d.get_dictionary(outlines)?.get(b"First")?.as_reference()?;
            for _ in 0..*index {
                id = d.get_dictionary(id)?.get(b"Next")?.as_reference()?;
            }
            let item = d.get_dictionary(id)?.clone();
            let prev = item.get(b"Prev").and_then(Object::as_reference).ok();
            let next = item.get(b"Next").and_then(Object::as_reference).ok();
            for (target, key, value) in [
                (
                    prev.unwrap_or(outlines),
                    if prev.is_some() {
                        b"Next".as_slice()
                    } else {
                        b"First"
                    },
                    next,
                ),
                (
                    next.unwrap_or(outlines),
                    if next.is_some() {
                        b"Prev".as_slice()
                    } else {
                        b"Last"
                    },
                    prev,
                ),
            ] {
                let a = d.get_object_mut(target)?.as_dict_mut()?;
                if let Some(value) = value {
                    a.set(key, value);
                } else {
                    a.remove(key);
                }
            }
        }
        EditCommand::Field {
            page,
            rect,
            name,
            field_type,
            value,
            required,
        } => {
            rect.validate()?;
            if name.trim().is_empty() || name.len() > 200 {
                return fail("Give the form field a short, unique name.");
            }
            let (_, mut form) = field_tree(&d)?;
            let mut fields = form
                .get(b"Fields")
                .ok()
                .and_then(|o| resolve(&d, o).ok())
                .and_then(|o| o.as_array().ok())
                .cloned()
                .unwrap_or_default();
            for f in &fields {
                if resolve(&d, f)?
                    .as_dict()?
                    .get(b"T")
                    .map(string)
                    .unwrap_or_default()
                    == *name
                {
                    return fail("A field with this name already exists.");
                }
            }
            if !["text", "checkbox"].contains(&field_type.as_str()) {
                return fail("Choose a text field or checkbox.");
            }
            let id = page_id(&d, *page)?;
            let h = page_height(&d, id)?;
            let check = field_type == "checkbox";
            let mut field = dictionary! {"Type"=>"Annot","Subtype"=>"Widget","Rect"=>rectangle(rect,h),"FT"=>if check{"Btn"}else{"Tx"},"T"=>pdf_string(name),"TU"=>pdf_string(name),"F"=>4,"Ff"=>if *required{2}else{0}};
            if check {
                let on = appearance(&mut d, rect.width, rect.height, "", true);
                let off = appearance(&mut d, rect.width, rect.height, "", false);
                field.set("AP", dictionary! {"N"=>dictionary!{"Yes"=>on,"Off"=>off}});
                let state = if value == "Yes" { "Yes" } else { "Off" };
                field.set("V", Object::Name(state.as_bytes().to_vec()));
                field.set("AS", Object::Name(state.as_bytes().to_vec()));
            } else {
                let ap = appearance(&mut d, rect.width, rect.height, value, false);
                field.set("AP", dictionary! {"N"=>ap});
                field.set("V", pdf_string(value));
                field.set("DA", Object::string_literal("/Helv 11 Tf 0 g"));
            }
            let field = append_annotation(&mut d, id, field)?;
            fields.push(field.into());
            form.set("Fields", fields);
            let font = d.add_object(
                dictionary! {"Type"=>"Font","Subtype"=>"Type1","BaseFont"=>"Helvetica"},
            );
            form.set("DR", dictionary! {"Font"=>dictionary!{"Helv"=>font}});
            form.set("NeedAppearances", false);
            commit_form(&mut d, form)?;
        }
        EditCommand::FillField { name, value } => {
            let ids: Vec<_> = d
                .objects
                .iter()
                .filter_map(|(id, o)| {
                    o.as_dict()
                        .ok()
                        .filter(|a| {
                            a.get(b"T").map(string).unwrap_or_default() == *name && a.has(b"FT")
                        })
                        .map(|_| *id)
                })
                .collect();
            if ids.is_empty() {
                return fail("The field was not found.");
            }
            for id in ids {
                let f = d.get_dictionary(id)?.clone();
                let kind = f.get(b"FT")?.as_name()?;
                if kind == b"Btn" {
                    if !["Yes", "Off"].contains(&value.as_str()) {
                        return fail("Checkbox value must be Yes or Off.");
                    }
                    let a = d.get_object_mut(id)?.as_dict_mut()?;
                    a.set("V", Object::Name(value.as_bytes().to_vec()));
                    a.set("AS", Object::Name(value.as_bytes().to_vec()));
                } else if kind == b"Tx" {
                    let rect = f.get(b"Rect")?.as_array()?;
                    let ap = appearance(
                        &mut d,
                        rect[2].as_float()? - rect[0].as_float()?,
                        rect[3].as_float()? - rect[1].as_float()?,
                        value,
                        false,
                    );
                    let a = d.get_object_mut(id)?.as_dict_mut()?;
                    a.set("V", pdf_string(value));
                    a.set("AP", dictionary! {"N"=>ap});
                } else {
                    return fail("This field type needs a dedicated editor.");
                }
            }
        }
        EditCommand::FlattenForms => {
            for id in d.get_pages().values() {
                let annotations = d
                    .get_dictionary(*id)?
                    .get(b"Annots")
                    .ok()
                    .and_then(|o| resolve(&d, o).ok())
                    .and_then(|o| o.as_array().ok())
                    .cloned()
                    .unwrap_or_default();
                let mut kept = Vec::new();
                let mut resources = inherited(&d, *id, b"Resources")
                    .ok()
                    .and_then(|o| o.as_dict().cloned().ok())
                    .unwrap_or_default();
                let mut xobjects = resources
                    .get(b"XObject")
                    .ok()
                    .and_then(|o| resolve(&d, o).ok())
                    .and_then(|o| o.as_dict().ok())
                    .cloned()
                    .unwrap_or_default();
                let mut stream = String::new();
                for (i, o) in annotations.into_iter().enumerate() {
                    let a = resolve(&d, &o)?.as_dict()?.clone();
                    if a.get(b"Subtype").and_then(Object::as_name).ok() != Some(b"Widget") {
                        kept.push(o);
                        continue;
                    }
                    let ap = resolve(&d, a.get(b"AP")?)?.as_dict()?.get(b"N")?;
                    let ap = if let Ok(dict) = ap.as_dict() {
                        dict.get(a.get(b"AS")?.as_name()?)?
                    } else {
                        ap
                    };
                    let ap = ap.as_reference()?;
                    let rect = a.get(b"Rect")?.as_array()?;
                    let name = format!("Flatten{}", i);
                    xobjects.set(name.as_bytes(), ap);
                    stream.push_str(&format!(
                        "q 1 0 0 1 {} {} cm /{} Do Q\n",
                        rect[0].as_float()?,
                        rect[1].as_float()?,
                        name
                    ));
                }
                resources.set("XObject", xobjects);
                d.get_object_mut(*id)?
                    .as_dict_mut()?
                    .set("Resources", resources);
                d.get_object_mut(*id)?.as_dict_mut()?.set("Annots", kept);
                d.add_page_contents(*id, stream.into_bytes())?;
            }
            let root = root_id(&d)?;
            d.get_object_mut(root)?.as_dict_mut()?.remove(b"AcroForm");
        }
        _ => return fail("Command does not belong to the structural engine."),
    }
    d.prune_objects();
    let mut out = Vec::new();
    d.save_to(&mut out)?;
    Document::load_mem(&out)?;
    Ok(out)
}
