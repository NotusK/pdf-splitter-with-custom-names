import io
import math
import zipfile
import tempfile
import os
import fitz

from flask import Flask, render_template, request, send_file, jsonify

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 50 * 1024 * 1024  # 100 MB max upload


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/split", methods=["POST"])
def split_pdf():
    # ── Validate inputs ──────────────────────────────────────────────
    if "pdf" not in request.files:
        return jsonify({"detail": "Harap upload file berjenis PDF."}), 400

    pdf_file = request.files["pdf"]
    if pdf_file.filename == "" or not pdf_file.filename.lower().endswith(".pdf"):
        return jsonify({"detail": "Harap upload file berjenis PDF."}), 400

    try:
        pages_per_split = int(request.form.get("pages_per_split", 0))
        if pages_per_split < 1:
            raise ValueError
    except ValueError:
        return jsonify({"detail": "pages_per_split must be a positive integer."}), 400

    raw_names = request.form.get("names", "")

    output_names = [n.strip() for n in raw_names.splitlines() if n.strip()]
    if not output_names:
        return jsonify({"detail": "No output file names provided."}), 400

    if len(set(output_names)) != len(output_names):
        return jsonify({
            "detail": "Hindari nama yang duplikat"
        }), 400

    # ── Read PDF ─────────────────────────────────────────────────────
    try:
        doc = fitz.open(stream=pdf_file.read(), filetype="pdf")
    except Exception:
        return jsonify({"detail": "Could not read the uploaded PDF."}), 400

    total_pages = len(doc)
    total_chunks = math.ceil(total_pages / pages_per_split)

    if len(output_names) != total_chunks:
        return jsonify({
            "detail": (
                f"Jumlah nama yang diberikan kurang atau lebih dari jumlah pdf"
                f"Name count mismatch: {len(output_names)} names provided "
                f"but the PDF will produce {total_chunks} file(s) "
                f"({total_pages} pages ÷ {pages_per_split} per file)."
            )
        }), 400

    # ── Split & zip in memory ─────────────────────────────────────────
    temp_zip = tempfile.NamedTemporaryFile(delete=False)

    chunks = [
        (start, min(start + pages_per_split, total_pages))
        for start in range(0, total_pages, pages_per_split)
    ]

    with zipfile.ZipFile(temp_zip.name, "w", zipfile.ZIP_STORED) as zf:
        for idx, (start, end) in enumerate(chunks):
            end = min(start + pages_per_split, total_pages)

            new_pdf = fitz.open()

            new_pdf.insert_pdf(
                doc,
                from_page=start,
                to_page=end - 1
            )

            pdf_bytes = new_pdf.tobytes()

            zf.writestr(
                f"{output_names[idx]}.pdf",
                pdf_bytes
            )

            new_pdf.close()

    temp_zip.seek(0)

    base_name = os.path.splitext(pdf_file.filename)[0]
    zip_name = f"split_{base_name}.zip"

    doc.close()

    return send_file(
        temp_zip,
        mimetype="application/zip",
        as_attachment=True,
        download_name=zip_name,
    )

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)