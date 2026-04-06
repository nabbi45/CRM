import { useEffect } from 'react';
import { apiUrl } from './LoginSignup';

/**
 * Sets document.title and favicon dynamically from Company Profile.
 * Prevents stretching by centering the logo in a square canvas.
 */
const DynamicHead = () => {
    useEffect(() => {
        const applyBranding = async () => {
            try {
                const res = await fetch(`${apiUrl}/company/public`);
                const data = await res.json();
                
                if (res.ok) {
                    const cName = data.company_name || "Dashboard";
                    document.title = cName;

                    if (data.logo_url) {
                        const img = new Image();
                        img.crossOrigin = "anonymous";
                        img.onload = () => {
                            const canvas = document.createElement("canvas");
                            const size = Math.max(img.width, img.height);
                            canvas.width = size;
                            canvas.height = size;
                            const ctx = canvas.getContext("2d");

                            // Center the image in the square canvas to prevent stretching
                            const x = (size - img.width) / 2;
                            const y = (size - img.height) / 2;
                            ctx.drawImage(img, x, y);

                            let link = document.querySelector("link[rel~='icon']");
                            if (!link) {
                                link = document.createElement('link');
                                link.rel = 'icon';
                                document.head.appendChild(link);
                            }
                            link.href = canvas.toDataURL("image/png");
                        };
                        img.src = data.logo_url;
                    }
                }
            } catch (e) {
                /* fallback to default */
            }
        };
        applyBranding();
    }, []);

    return null;
};

export default DynamicHead;
