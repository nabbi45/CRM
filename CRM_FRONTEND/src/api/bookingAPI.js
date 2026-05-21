import { apiUrl } from "../components/LoginSignup"; // Ensure the correct import of API base URL from environment

const bookingAPI = {
  // Get all bookings
  getAllBookings: async () => {
    try {
      // Retrieve the user session from localStorage
      const userSession = JSON.parse(localStorage.getItem("userSession"));
      if (!userSession || !userSession.token) {
        throw new Error('User is not authenticated. Please log in.');
      }

      // API request to fetch all bookings
      const response = await fetch(`${apiUrl}/booking/all`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `${userSession.token}`, // Attach token in Authorization header
        },
      });

      if (!response.ok) {
        // Handle Unauthorized error (401)
        if (response.status === 401) {
          throw new Error('Unauthorized access. Please log in again.');
        }
        throw new Error('Failed to fetch bookings');
      }

      const data = await response.json();

      // Check if the response contains valid data
      if (data && Array.isArray(data.Allbookings)) {
        return { data: data.Allbookings }; // Return fetched bookings
      } else if (data && Array.isArray(data)) {
        return { data };
      } else if (data && data.bookings && Array.isArray(data.bookings)) {
        return { data: data.bookings };
      } else {
        let textData = '';
        try { textData = JSON.stringify(data); } catch (e) { textData = String(data); }
        throw new Error(`Invalid response format: Expected an array of bookings. Received: ${textData}`);
      }
    } catch (error) {
      console.error('Error fetching bookings:', error);
      throw new Error(`Failed to load bookings. Please try again. ${error.message}`);
    }
  },

  // Generate agreement for a specific booking
  generateAgreement: async (bookingId) => {
    try {
      const userSession = JSON.parse(localStorage.getItem("userSession"));
      if (!userSession || !userSession.token) {
        throw new Error('User is not authenticated. Please log in.');
      }

      const response = await fetch(`${apiUrl}/generate-agreement/${bookingId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `${userSession.token}`, // Ensure correct authorization
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to generate agreement');
      }

      const data = await response.json();
      return { data }; // Return the generated agreement HTML
    } catch (error) {
      console.error('Error generating agreement:', error);
      throw new Error(`Error generating agreement. ${error.message}`);
    }
  },

  // Get specific booking details
  getBooking: async (bookingId) => {
    try {
      const userSession = JSON.parse(localStorage.getItem("userSession"));
      if (!userSession || !userSession.token) {
        throw new Error('User is not authenticated. Please log in.');
      }

      const response = await fetch(`${apiUrl}/bookings/${bookingId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `${userSession.token}`, // Ensure correct authorization
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch booking details');
      }

      const data = await response.json();
      return { data }; // Return specific booking details
    } catch (error) {
      console.error('Error fetching booking details:', error);
      throw new Error(`Failed to fetch booking details. ${error.message}`);
    }
  },
};

export default bookingAPI;
