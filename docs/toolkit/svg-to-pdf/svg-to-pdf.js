function updateFileInfo(name) {
    fileNameDisplay.textContent = `Selected: ${name}`;
    fileInfo.classList.remove('hidden');
}

function wrapDimension(dimension) {
    if (typeof dimension === 'number') {
        console.warn(`Dimension is a number (${dimension}). Appending 'px' to ensure valid CSS format.`);
        return dimension + 'px';
    }
    else if (typeof dimension === 'string') {
        // If the dimension is already in a valid CSS format (e.g., '100%', '200px', '2in'), return it as is
        // This regex checks for valid CSS units (px, em, rem, %, in, cm, mm, pt, pc)
        const cssUnitRegex = /^-?\d*\.?\d+(px|em|rem|%|in|cm|mm|pt|pc)$/;
        if (cssUnitRegex.test(dimension.trim())) {
            console.warn(`Dimension is already in a valid CSS format: ${dimension}. Returning as is.`);
            return dimension;
        }
        else {
            // If the dimension is a number in string format (e.g., '200'), append 'px'
            const numericValue = parseFloat(dimension);
            if (!isNaN(numericValue)) {
                console.warn(`Dimension is a valid number: ${numericValue}. Appending 'px' to ensure valid CSS format.`);
                return numericValue + 'px';
            }
            else {
                // If it's not a valid number, return it as is (or handle as needed)
                console.warn(`Invalid dimension format: ${dimension}. Returning as is.`);
                return dimension;
            }

        }
    }
    return dimension;
}

function wrapDimensions(svgContent) {
    let width = svgContent.match(/width="([^"]+)"/)[1];
    let height = svgContent.match(/height="([^"]+)"/)[1];

    // if not found, try to get from viewBox
    if (!width || !height) {
        const viewBox = svgContent.match(/viewBox="([^"]+)"/);
        if (viewBox) {
            const viewBoxValues = viewBox[1].split(' ');
            width = viewBoxValues[2];
            height = viewBoxValues[3];
        }
    }
    return {
        width: wrapDimension(width ? width : '100%'),
        height: wrapDimension(height ? height : '100%')
    };
}

function createHTML(svgContent, width, height) {
    const pdfContent = `
        <html>
        <head>
            <style>
                body, html {
                    margin: 0;
                    padding: 0;
                }

                @page {
                    size: ${width} ${height};
                    margin: 0;
                }
                svg {
                    width: ${width}; 
                    height: ${height}; 
                    display: block;
                }
            </style>
        </head>
        <body>
            ${svgContent}
            <script>
                // Small delay to ensure rendering before print dialog
                window.onload = () => { 
                    setTimeout(() => { window.print(); }, 50); 
                };
            <\/script>
        </body>
        </html>
    `;
    return pdfContent;
}

function createPDF(svgContent, fileName) {

    const originalTitle = document.title; // Store the original title to restore later
    
    const { width, height } = wrapDimensions(svgContent);
    console.log('Wrapped dimensions:', width, height);

    const htmlContent = createHTML(svgContent, width, height);
    
    // use iframe

    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    iframe.contentWindow.document.open();
    iframe.contentWindow.document.write(htmlContent);
    iframe.contentWindow.document.close();


    iframe.contentWindow.onload = function() {

        // change the title of the document to set the default file name in the print dialog
        document.title = fileName.replace('.svg', '.pdf');
        iframe.contentWindow.print();

        // cleanup after printing
        setTimeout(() => {

            document.body.removeChild(iframe);
            document.title = originalTitle; // Restore the original title
        }, 1000);
    };
}

function convertToPDF() {
    const fileInput = document.getElementById('svgFile');
    const file = fileInput.files[0];

    

    if (!file) {
        alert('Please select an SVG file to convert.');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(event) {
        try {
            const svgContent = event.target.result;
            createPDF(svgContent, file.name);

        } catch (error) {
            console.error('Error converting SVG to PDF:', error);
            alert('An error occurred while converting the SVG to PDF. Please try again.');
        }
        
        
        
    };
    reader.onerror = function() {
        console.error('Error reading the SVG file:', reader.error);
        alert('An error occurred while reading the SVG file. Please try again.');
    };
    reader.readAsText(file);
}