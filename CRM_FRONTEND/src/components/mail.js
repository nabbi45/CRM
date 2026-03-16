
import { apiUrl } from "./LoginSignup";

const Mailer = (dataToSubmit) => {
  fetch(`${apiUrl}/mail/api/welcome`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(dataToSubmit),
  })
    .then((response) => {
      if (!response.ok) {
        console.warn("Welcome email request failed with status:", response.status);
      }
      return response.json();
    })
    .then((data) => {
      console.log("Welcome email response:", data.message);
    })
    .catch((err) => {
      console.warn("Welcome email network error (non-critical):", err.message);
    });
};

export default Mailer;