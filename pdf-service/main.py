from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
import weasyprint
from jinja2 import Template
import base64
import os
from pathlib import Path

app = FastAPI(title="Social Garden PDF Service")

class PDFRequest(BaseModel):
    html_content: str
    filename: str = "document"

# HTML template with Social Garden branding
SOW_TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Social Garden - Statement of Work</title>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        {{ css_content }}
    </style>
</head>
<body>
    <div class="sow-document">
        <div class="sow-header">
            {% if logo_base64 %}
            <img src="data:image/png;base64,{{ logo_base64 }}" alt="Social Garden Logo" class="sow-logo">
            {% endif %}
            <h1>Social Garden</h1>
            <p>Marketing Automation & Growth Specialists</p>
        </div>

        <div class="sow-content">
            {{ html_content }}
        </div>

        <div class="sow-footer">
            <hr>
            <p><strong>Social Garden Pty Ltd</strong></p>
            <p>marketing@socialgarden.com.au | www.socialgarden.com.au</p>
            <p>This document is confidential and intended solely for the addressee.</p>
        </div>
    </div>
</body>
</html>
"""

# Professional CSS for PDF generation with Social Garden Branding
DEFAULT_CSS = """
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');

body {
    font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    line-height: 1.6;
    color: #0e2e33;
    margin: 0;
    padding: 0;
    background: white;
}

.sow-document {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
    background: white;
}

.sow-header {
    text-align: center;
    margin-bottom: 2rem;
    padding-bottom: 1.5rem;
    border-bottom: 3px solid #20e28f;
}

.sow-logo {
    max-width: 180px;
    height: auto;
    margin-bottom: 1rem;
}

.sow-header h1 {
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 2.5rem;
    font-weight: 700;
    color: #0e2e33;
    margin: 0.5rem 0;
}

.sow-header p {
    color: #0e2e33;
    font-size: 1.1rem;
    margin: 0;
    font-weight: 500;
}

h1, h2, h3, h4, h5, h6 {
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-weight: 700;
    line-height: 1.3;
    color: #0e2e33;
    page-break-after: avoid;
}

h1 {
    font-size: 2rem;
    font-weight: 800;
    margin-bottom: 1.5rem;
    border-bottom: 3px solid #20e28f;
    padding-bottom: 0.5rem;
    page-break-after: avoid;
}

h2 {
    font-size: 1.75rem;
    font-weight: 700;
    margin-top: 2rem;
    margin-bottom: 1rem;
    color: #0e2e33;
    page-break-after: avoid;
}

h3 {
    font-size: 1.375rem;
    font-weight: 600;
    margin-top: 1.5rem;
    margin-bottom: 0.75rem;
    page-break-after: avoid;
}

h4 {
    font-size: 1.125rem;
    font-weight: 600;
    margin-top: 1rem;
    margin-bottom: 0.5rem;
}

p {
    margin-bottom: 1rem;
    line-height: 1.7;
}

strong, b {
    font-weight: 700;
    color: #0e2e33;
}

em, i {
    font-style: italic;
}

ul, ol {
    margin-bottom: 1rem;
    padding-left: 1.5rem;
    line-height: 1.8;
}

li {
    margin-bottom: 0.5rem;
}

/* Professional table styling with Social Garden colors */
table {
    width: 100%;
    border-collapse: collapse;
    margin: 1.5rem 0;
    font-size: 0.9rem;
    page-break-inside: auto;
    border: 2px solid #0e2e33;
}

thead {
    display: table-header-group;
}

tbody {
    display: table-row-group;
}

th {
    background-color: #0e2e33;
    color: white;
    padding: 0.875rem 1rem;
    text-align: left;
    font-weight: 700;
    border: 1px solid #0e2e33;
    font-family: 'Plus Jakarta Sans', sans-serif;
}

td {
    padding: 0.875rem 1rem;
    border: 1px solid #d1d5db;
    color: #0e2e33;
    vertical-align: top;
}

tbody tr:nth-child(even) {
    background-color: #f9fafb;
}

tbody tr:nth-child(odd) {
    background-color: white;
}

tbody tr:hover {
    background-color: #f0fdf4;
}

/* Ensure tables don't break mid-row */
tr {
    page-break-inside: avoid;
}

/* Code blocks */
pre {
    background: #f8f9fa;
    border: 1px solid #e5e7eb;
    border-radius: 0.375rem;
    padding: 1rem;
    overflow-x: auto;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 0.875rem;
    margin: 1rem 0;
    page-break-inside: avoid;
}

code {
    background: #f3f4f6;
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 0.875rem;
    color: #0e2e33;
}

pre code {
    background: transparent;
    padding: 0;
}

/* Blockquotes */
blockquote {
    border-left: 4px solid #20e28f;
    padding-left: 1rem;
    margin: 1.5rem 0;
    font-style: italic;
    color: #4b5563;
}

/* Links */
a {
    color: #20e28f;
    text-decoration: underline;
}

a:hover {
    color: #0e2e33;
}

/* Horizontal rules */
hr {
    border: none;
    border-top: 2px solid #20e28f;
    margin: 2rem 0;
}

/* Page breaks */
.page-break {
    page-break-before: always;
}

.no-break {
    page-break-inside: avoid;
}

/* Footer */
.sow-footer {
    margin-top: 3rem;
    padding-top: 1.5rem;
    border-top: 2px solid #20e28f;
}

.sow-footer p {
    color: #6b7280;
    font-size: 0.8rem;
    margin: 0.5rem 0;
    text-align: center;
}

/* Print-specific styles */
@media print {
    body {
        font-size: 11pt;
    }

    .sow-document {
        padding: 1rem;
        max-width: none;
    }

    h1 {
        font-size: 22pt;
    }

    h2 {
        font-size: 18pt;
    }

    h3 {
        font-size: 14pt;
    }

    table {
        font-size: 9pt;
    }
}

/* Ensure content readability */
.sow-content {
    font-size: 0.95rem;
}

/* Special styling for important sections */
.highlight {
    background-color: #ecfdf5;
    border-left: 4px solid #20e28f;
    padding: 1rem;
    margin: 1rem 0;
}
"""

@app.post("/generate-pdf")
async def generate_pdf(request: PDFRequest):
    try:
        # Load and encode the Social Garden logo
        logo_base64 = ""
        logo_path = Path(__file__).parent / "social-garden-logo-dark.png"
        if logo_path.exists():
            with open(logo_path, "rb") as logo_file:
                logo_base64 = base64.b64encode(logo_file.read()).decode('utf-8')
        
        # Render the HTML template with Jinja2
        template = Template(SOW_TEMPLATE)
        full_html = template.render(
            html_content=request.html_content,
            css_content=DEFAULT_CSS,
            logo_base64=logo_base64
        )
        
        # Generate PDF with WeasyPrint
        html_doc = weasyprint.HTML(string=full_html)
        
        # Create output directory if it doesn't exist
        output_dir = Path("/tmp/pdfs")
        output_dir.mkdir(exist_ok=True)
        
        # Generate PDF
        pdf_path = output_dir / f"{request.filename}.pdf"
        
        # Write PDF to bytes then to file
        pdf_bytes = html_doc.write_pdf()
        
        # Write to file
        with open(pdf_path, 'wb') as f:
            f.write(pdf_bytes)

        # Return PDF file
        return FileResponse(
            pdf_path,
            media_type='application/pdf',
            filename=f"{request.filename}.pdf"
        )

    except Exception as e:
        import traceback
        error_detail = f"PDF generation failed: {str(e)}\n{traceback.format_exc()}"
        print(error_detail)  # Log to console
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {str(e)}")

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "Social Garden PDF Service"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
