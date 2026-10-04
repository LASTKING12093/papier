fn main() {
    let args: Vec<_> = std::env::args().collect();
    if args.len() != 3 {
        eprintln!("Usage: pdf-worker <pdfium-library> <recovery-directory>");
        std::process::exit(2);
    }
    if let Err(e) =
        pdf_core::workspace::worker_main(std::path::Path::new(&args[1]), args[2].clone().into())
    {
        eprintln!("{}", e);
        std::process::exit(1);
    }
}
