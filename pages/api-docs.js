import { useEffect } from 'react';
import Head from 'next/head';

export default function SwaggerDocs() {
  useEffect(() => {
    // Load Swagger UI dynamically
    const script1 = document.createElement('script');
    script1.src = 'https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-bundle.js';
    script1.async = true;
    document.body.appendChild(script1);

    const script2 = document.createElement('script');
    script2.src = 'https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-standalone-preset.js';
    script2.async = true;
    document.body.appendChild(script2);

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui.css';
    document.head.appendChild(link);

    script1.onload = () => {
      script2.onload = () => {
        if (window.SwaggerUIBundle) {
          // Get the current hostname to ensure we use the correct server
          const currentHost = window.location.host;
          const protocol = window.location.protocol;
          
          fetch('/api/swagger.json')
            .then(res => {
              if (!res.ok) {
                throw new Error(`Failed to load Swagger spec: ${res.status} ${res.statusText}`);
              }
              return res.json();
            })
            .then(spec => {
              // Update the spec to use the current hostname as the primary server
              if (spec.servers && spec.servers.length > 0) {
                // Set the first server to use the current hostname
                spec.servers[0] = {
                  url: `${protocol}//${currentHost}/api`,
                  description: 'Current server'
                };
              }
              
              window.ui = window.SwaggerUIBundle({
                spec: spec,
                dom_id: '#swagger-ui',
                deepLinking: true,
                presets: [
                  window.SwaggerUIBundle.presets.apis,
                  window.SwaggerUIStandalonePreset
                ],
                plugins: [
                  window.SwaggerUIBundle.plugins.DownloadUrl
                ],
                layout: "StandaloneLayout",
                tryItOutEnabled: true
              });
            })
            .catch(error => {
              console.error('Error loading Swagger UI:', error);
              const swaggerContainer = document.getElementById('swagger-ui');
              if (swaggerContainer) {
                swaggerContainer.innerHTML = `
                  <div style="padding: 20px; text-align: center;">
                    <h2>Error loading Swagger documentation</h2>
                    <p>${error.message}</p>
                    <p>Please ensure the server is running and accessible.</p>
                  </div>
                `;
              }
            });
        }
      };
    };

    return () => {
      document.body.removeChild(script1);
      document.body.removeChild(script2);
    };
  }, []);

  return (
    <>
      <Head>
        <title>Global Olympiad API Documentation</title>
        <style>{`
          html {
            box-sizing: border-box;
            overflow: -moz-scrollbars-vertical;
            overflow-y: scroll;
          }
          *,
          *:before,
          *:after {
            box-sizing: inherit;
          }
          body {
            margin: 0;
            background: #fafafa;
          }
        `}</style>
      </Head>
      <div id="swagger-ui"></div>
    </>
  );
}

