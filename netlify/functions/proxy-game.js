const fetch = require('node-fetch'); // You'll need to install this: npm install node-fetch@2
const { URL } = require('url');

exports.handler = async (event, context) => {
    const targetUrlString = event.queryStringParameters.target;

    if (!targetUrlString) {
        return {
            statusCode: 400,
            body: 'Error: "target" query parameter is required.',
        };
    }

    let targetUrl;
    try {
        targetUrl = new URL(targetUrlString);
    } catch (e) {
        return {
            statusCode: 400,
            body: `Error: Invalid "target" URL: ${targetUrlString}`,
        };
    }

    console.log(`[Proxy Game] Fetching: ${targetUrlString}`);

    try {
        const response = await fetch(targetUrlString, {
            headers: {
                // Mimic a browser a bit, though not strictly necessary for all targets
                'User-Agent': event.headers['user-agent'] || 'SaneGames-Proxy/1.0',
                'Accept': event.headers['accept'] || '*/*',
                'Accept-Language': event.headers['accept-language'] || 'en-US,en;q=0.9',
                // Forward other potentially relevant headers if needed, but be cautious
            },
            redirect: 'follow', // Handle redirects from the target
        });

        let body = await response.buffer(); // Get body as a buffer for binary data handling
        const contentType = response.headers.get('content-type') || '';

        // Prepare headers for the client response
        const responseHeaders = {
            'Access-Control-Allow-Origin': '*', // Allow any origin to access this proxy
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Content-Type': contentType,
            // Remove problematic headers from the original response
            // 'X-Frame-Options': null, // Will be omitted
            // 'Content-Security-Policy': null, // Will be omitted
        };

        // Pass through some useful headers from the original response
        const passThroughHeaders = [
            'content-disposition', 'content-length', 'date', 'etag', 'last-modified', 'cache-control', 'expires', 'vary'
        ];
        response.headers.forEach((value, name) => {
            if (passThroughHeaders.includes(name.toLowerCase())) {
                responseHeaders[name] = value;
            }
        });


        if (contentType.includes('text/html')) {
            let htmlContent = body.toString('utf-8');
            // Construct base URL: scheme://host/path/ (if path ends with /) or scheme://host/ (if no path or path is just /)
            // or scheme://host/directory_of_file/ (if path points to a file like index.html)
            const pathParts = targetUrl.pathname.split('/');
            if (pathParts[pathParts.length - 1].includes('.')) { // If last part is a filename
                pathParts.pop(); // Remove filename to get directory
            }
            const basePath = `${targetUrl.protocol}//${targetUrl.host}${pathParts.join('/')}${pathParts.length > 1 && !pathParts[pathParts.length-1].endsWith('/') ? '/' : ''}`;
            
            const baseTag = `<base href="${basePath}">`;
            console.log(`[Proxy Game] Injecting base tag: ${baseTag} into HTML for ${targetUrlString}`);

            // Inject base tag right after <head> or at the beginning if no <head>
            if (htmlContent.includes('<head>')) {
                htmlContent = htmlContent.replace('<head>', `<head>\n${baseTag}`);
            } else if (htmlContent.includes('<html>')) {
                htmlContent = htmlContent.replace('<html>', `<html>\n<head>\n${baseTag}\n</head>`);
            } else {
                // Best effort if no standard tags
                htmlContent = `${baseTag}\n${htmlContent}`;
            }
            body = htmlContent; // Body is now string
            // Content-Length might change if we modified HTML, remove it to let Netlify handle it or re-calculate
            delete responseHeaders['content-length'];
        }

        return {
            statusCode: response.status,
            headers: responseHeaders,
            body: Buffer.isBuffer(body) ? body.toString('base64') : body, // If it's still a buffer, base64 encode
            isBase64Encoded: Buffer.isBuffer(body),
        };

    } catch (error) {
        console.error('[Proxy Game] Error fetching target URL:', error);
        return {
            statusCode: 502, // Bad Gateway
            body: `Error: Could not proxy target URL. ${error.message}`,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'text/plain',
            }
        };
    }
};