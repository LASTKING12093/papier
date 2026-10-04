//! Detached CMS signatures. Keys remain in Windows certificate providers.
use crate::{fail, Result};
use lopdf::{dictionary, Document, Object};
use serde_json::{json, Value};

const SIGNATURE_BYTES: usize = 16384;
pub fn prepare(bytes: &[u8]) -> Result<Vec<u8>> {
    let mut d = Document::load_mem(bytes)?;
    if d.objects.values().any(|o| {
        o.as_dict()
            .is_ok_and(|v| v.get(b"Type").and_then(Object::as_name).ok() == Some(b"Sig"))
    }) {
        return fail("This file already has a signature. Multi-signature incremental signing is not supported.");
    }
    let sig=d.add_object(dictionary!{"Type"=>"Sig","Filter"=>"Adobe.PPKLite","SubFilter"=>"adbe.pkcs7.detached","ByteRange"=>vec![0.into(),1111111111i64.into(),2222222222i64.into(),3333333333i64.into()],"Contents"=>Object::String(vec![0xab;SIGNATURE_BYTES],lopdf::StringFormat::Hexadecimal),"Reason"=>Object::string_literal("Document approval")});
    let page = *d
        .get_pages()
        .values()
        .next()
        .ok_or("Document has no pages")?;
    let field=d.add_object(dictionary!{"Type"=>"Annot","Subtype"=>"Widget","FT"=>"Sig","T"=>Object::string_literal(format!("Signature_{}",sig.0)),"V"=>sig,"Rect"=>vec![0.into(),0.into(),0.into(),0.into()],"P"=>page,"F"=>132});
    let root = d.trailer.get(b"Root")?.as_reference()?;
    let mut form = d
        .get_dictionary(root)?
        .get(b"AcroForm")
        .ok()
        .and_then(|v| v.as_reference().ok())
        .and_then(|id| d.get_dictionary(id).ok())
        .cloned()
        .unwrap_or_default();
    let mut fields = form
        .get(b"Fields")
        .and_then(Object::as_array)
        .cloned()
        .unwrap_or_default();
    fields.push(field.into());
    form.set("Fields", fields);
    form.set("SigFlags", 3);
    let form_id = d.add_object(form);
    d.get_object_mut(root)?
        .as_dict_mut()?
        .set("AcroForm", form_id);
    let mut annotations = d
        .get_dictionary(page)?
        .get(b"Annots")
        .and_then(Object::as_array)
        .cloned()
        .unwrap_or_default();
    annotations.push(field.into());
    d.get_object_mut(page)?
        .as_dict_mut()?
        .set("Annots", annotations);
    let mut out = Vec::new();
    d.save_to(&mut out)?;
    let marker = b"AB".repeat(SIGNATURE_BYTES);
    let marker_lower = b"ab".repeat(SIGNATURE_BYTES);
    let start = out
        .windows(marker.len())
        .position(|w| w == marker || w == marker_lower)
        .ok_or("Could not locate signature content")?
        - 1;
    let end = start + SIGNATURE_BYTES * 2 + 2;
    let br = out
        .windows(10)
        .position(|w| w == b"/ByteRange")
        .ok_or("Missing signature byte range")?;
    let open = br
        + out[br..]
            .iter()
            .position(|&b| b == b'[')
            .ok_or("Invalid signature byte range")?;
    let close = open
        + out[open..]
            .iter()
            .position(|&b| b == b']')
            .ok_or("Invalid signature byte range")?;
    let replacement = format!("0 {} {} {}", start, end, out.len() - end);
    if replacement.len() > close - open - 1 {
        return fail("Document is too large for the signature reservation.");
    }
    out[open + 1..close].fill(b' ');
    out[open + 1..open + 1 + replacement.len()].copy_from_slice(replacement.as_bytes());
    Ok(out)
}
fn signature_parts(bytes: &[u8]) -> Result<(Vec<u8>, usize, usize)> {
    let d = Document::load_mem(bytes)?;
    let sig = d
        .objects
        .values()
        .filter_map(|o| o.as_dict().ok())
        .find(|d| d.get(b"Type").and_then(Object::as_name).ok() == Some(b"Sig"))
        .ok_or("No digital signature")?;
    let a = sig.get(b"ByteRange")?.as_array()?;
    if a.len() != 4 {
        return fail("Invalid signature byte range.");
    }
    let n = a
        .iter()
        .map(|o| Ok(usize::try_from(o.as_i64()?)?))
        .collect::<Result<Vec<_>>>()?;
    if n[0] != 0
        || n[1] >= n[2]
        || n[2].checked_add(n[3]) != Some(bytes.len())
        || bytes.get(n[1]) != Some(&b'<')
        || bytes.get(n[2] - 1) != Some(&b'>')
    {
        return fail("Signature byte range does not cover this exact document revision.");
    }
    let mut content = bytes[..n[1]].to_vec();
    content.extend_from_slice(&bytes[n[2]..]);
    Ok((content, n[1], n[2]))
}
#[cfg(windows)]
pub fn sign_with_windows_store(bytes: &[u8]) -> Result<Vec<u8>> {
    use windows_sys::Win32::Security::Cryptography::{UI::CryptUIDlgSelectCertificateFromStore, *};
    signature_parts(bytes)?;
    let store_name: Vec<u16> = "MY\0".encode_utf16().collect();
    let title: Vec<u16> = "Choose a signing certificate\0".encode_utf16().collect();
    let description: Vec<u16> = "The private key stays in your Windows certificate provider.\0"
        .encode_utf16()
        .collect();
    // SAFETY: handles are checked; buffers live across each synchronous Windows API call.
    unsafe {
        let store = CertOpenSystemStoreW(0, store_name.as_ptr());
        if store.is_null() {
            return fail("Windows certificate store is unavailable.");
        }
        let cert = CryptUIDlgSelectCertificateFromStore(
            store,
            std::ptr::null_mut(),
            title.as_ptr(),
            description.as_ptr(),
            0,
            0,
            std::ptr::null(),
        );
        if cert.is_null() {
            CertCloseStore(store, 0);
            return fail("Certificate selection was cancelled.");
        }
        let result = sign_with_context(bytes, cert);
        CertFreeCertificateContext(cert);
        CertCloseStore(store, 0);
        result
    }
}
#[cfg(windows)]
unsafe fn sign_with_context(
    bytes: &[u8],
    mut cert: *mut windows_sys::Win32::Security::Cryptography::CERT_CONTEXT,
) -> Result<Vec<u8>> {
    use windows_sys::Win32::Security::Cryptography::*;
    let (content, start, end) = signature_parts(bytes)?;

    let mut para: CRYPT_SIGN_MESSAGE_PARA = std::mem::zeroed();
    para.cbSize = std::mem::size_of_val(&para) as u32;
    para.dwMsgEncodingType = X509_ASN_ENCODING | PKCS_7_ASN_ENCODING;
    para.pSigningCert = cert;
    para.HashAlgorithm.pszObjId = szOID_NIST_sha256 as _;
    para.cMsgCert = 1;
    para.rgpMsgCert = &mut cert;
    let ptr = content.as_ptr();
    let len = u32::try_from(content.len())?;
    let mut count = 0;
    if CryptSignMessage(&para, 1, 1, &ptr, &len, std::ptr::null_mut(), &mut count) == 0 {
        return fail(&format!(
            "The selected certificate cannot sign: {}",
            std::io::Error::last_os_error()
        ));
    }
    let mut cms = vec![0; count as usize];
    if CryptSignMessage(&para, 1, 1, &ptr, &len, cms.as_mut_ptr(), &mut count) == 0 {
        return fail("Windows could not create the cryptographic signature.");
    }
    cms.truncate(count as usize);
    if cms.len() > SIGNATURE_BYTES {
        return fail("Certificate chain exceeds the signature reservation.");
    }
    let mut out = bytes.to_vec();
    out[start + 1..end - 1].fill(b'0');
    let hex = cms.iter().map(|b| format!("{:02X}", b)).collect::<String>();
    out[start + 1..start + 1 + hex.len()].copy_from_slice(hex.as_bytes());
    let verified = verify(&out)?;
    if verified["integrity"] != true {
        return fail("The generated signature failed its integrity check.");
    }
    Ok(out)
}
#[cfg(windows)]
pub fn verify(bytes: &[u8]) -> Result<Value> {
    use windows_sys::Win32::Security::Cryptography::*;
    let (content, _, _) = signature_parts(bytes)?;
    let d = Document::load_mem(bytes)?;
    let sig = d
        .objects
        .values()
        .filter_map(|o| o.as_dict().ok())
        .find(|v| v.get(b"Type").and_then(Object::as_name).ok() == Some(b"Sig"))
        .ok_or("No signature")?;
    let cms = sig.get(b"Contents")?.as_str()?;
    // CryptoAPI accepts the DER CMS object; padding after its ASN.1 length is excluded.
    if cms.len() < 2 || cms[0] != 0x30 {
        return fail("Invalid CMS signature encoding.");
    }
    let (header, payload) = if cms[1] & 0x80 == 0 {
        (2, cms[1] as usize)
    } else {
        let count = (cms[1] & 0x7f) as usize;
        if count == 0 || count > 4 || cms.len() < count + 2 {
            return fail("Invalid CMS length.");
        }
        let len = cms[2..2 + count]
            .iter()
            .fold(0usize, |a, b| a * 256 + *b as usize);
        (2 + count, len)
    };
    let len = header + payload;
    if len > cms.len() {
        return fail("Truncated CMS signature.");
    }
    unsafe {
        let mut para: CRYPT_VERIFY_MESSAGE_PARA = std::mem::zeroed();
        para.cbSize = std::mem::size_of_val(&para) as u32;
        para.dwMsgAndCertEncodingType = X509_ASN_ENCODING | PKCS_7_ASN_ENCODING;
        let mut cert = std::ptr::null_mut();
        let ptr = content.as_ptr();
        let size = content.len() as u32;
        let valid = CryptVerifyDetachedMessageSignature(
            &para,
            0,
            cms.as_ptr(),
            len as u32,
            1,
            &ptr,
            &size,
            &mut cert,
        ) != 0;
        let mut signer = String::new();
        if !cert.is_null() {
            let count = CertGetNameStringW(
                cert,
                CERT_NAME_SIMPLE_DISPLAY_TYPE,
                0,
                std::ptr::null(),
                std::ptr::null_mut(),
                0,
            );
            let mut name = vec![0; count as usize];
            CertGetNameStringW(
                cert,
                CERT_NAME_SIMPLE_DISPLAY_TYPE,
                0,
                std::ptr::null(),
                name.as_mut_ptr(),
                count,
            );
            signer = String::from_utf16_lossy(&name[..name.len().saturating_sub(1)]);
            CertFreeCertificateContext(cert);
        }
        Ok(
            json!({"integrity":valid,"coversCurrentRevision":true,"signer":signer,"trust":"Certificate trust and revocation have not been checked. No network request was made.","timestamp":"Timestamp authority validation is not performed."}),
        )
    }
}
#[cfg(not(windows))]
pub fn verify(_bytes: &[u8]) -> Result<Value> {
    fail("Certificate verification currently requires Windows.")
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn signed_byte_ranges_are_exact() {
        let b = std::fs::read(
            std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
                .join("../../tests/fixtures/studio-brief.pdf"),
        )
        .unwrap();
        let prepared = prepare(&b).unwrap();
        let (content, start, end) = signature_parts(&prepared).unwrap();
        assert_eq!(content.len(), prepared.len() - (end - start));
        let mut tampered = prepared.clone();
        tampered.push(b' ');
        assert!(signature_parts(&tampered).is_err());
        assert!(verify(&prepared).is_err());
    }
}

#[cfg(all(test, windows))]
mod crypto_tests {
    use super::*;
    use windows_sys::Win32::Security::Cryptography::*;
    #[test]
    fn actual_certificate_signature_and_tamper_detection() {
        let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
        let mut pfx = zeroize::Zeroizing::new(
            std::fs::read(root.join("tmp/qa/test-identity.p12"))
                .expect("Run tests/fixtures/generate-test-certificate.py first"),
        );
        let blob = CRYPT_INTEGER_BLOB {
            cbData: pfx.len() as u32,
            pbData: pfx.as_mut_ptr(),
        };
        let empty = [0u16];
        unsafe {
            let store = PFXImportCertStore(
                &blob,
                empty.as_ptr(),
                PKCS12_NO_PERSIST_KEY | PKCS12_ALWAYS_CNG_KSP,
            );
            assert!(!store.is_null(), "ephemeral PFX import failed");
            let cert = CertEnumCertificatesInStore(store, std::ptr::null());
            assert!(!cert.is_null());
            let b = std::fs::read(root.join("tests/fixtures/studio-brief.pdf")).unwrap();
            let prepared = prepare(&b).unwrap();
            let signed = sign_with_context(&prepared, cert).unwrap();
            let report = verify(&signed).unwrap();
            assert_eq!(report["integrity"], true);
            assert_eq!(report["signer"], "PDF Editor ephemeral test");
            let mut changed = signed.clone();
            let at = changed.windows(8).position(|w| w == b"approval").unwrap();
            changed[at] = b'A';
            assert_eq!(verify(&changed).unwrap()["integrity"], false);
            std::fs::write(root.join("tmp/qa/signed-test.pdf"), signed).unwrap();
            CertFreeCertificateContext(cert);
            CertCloseStore(store, 0);
        }
    }
}
