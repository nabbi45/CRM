import { useEffect } from 'react';
import { apiUrl } from './LoginSignup';

/**
 * Sets document.title and favicon dynamically from Company Profile.
 * Renders nothing — just runs side effects.
 */
const DynamicHead = () => {
    useEffect(() => {
        const applyBranding = async () => {
            try {
                const res = await fetch(`${apiUrl}/company/public`);
                const data = await res.json();
                if (res.ok) {
                    document.title = "Dashboard";
                    if (data.logo_url) {
                        let link = document.querySelector("link[rel~='icon']");
                        if (!link) {
                            link = document.createElement('link');
                            link.rel = 'icon';
                            document.head.appendChild(link);
                        }
                        link.href = data.logo_url;
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
