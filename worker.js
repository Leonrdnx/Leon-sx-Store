export default {
  async fetch(request, env, ctx) {
    // --- KONFIGURASI ---
    const MAYAR_API_KEY = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxNzE0OGY1Ny1hMWQ1LTQ3YzYtYWYwOC1iNzhmMjUzNDFmNWUiLCJhY2NvdW50SWQiOiJhZTVjNGEzZi02MmIzLTQ1N2EtYmU0ZC1lNDM1NTkwMDEwMWUiLCJjcmVhdGVkQXQiOiIxNzcwNTUwNjQ3OTkwIiwicm9sZSI6ImRldmVsb3BlciIsInN1YiI6ImhhZmlkemFsZ292dXJAZ21haWwuY29tIiwibmFtZSI6Ikxlb24nc3ggU3RvcmUiLCJsaW5rIjoibGVvbnN4LXN0b3JlIiwiaXNTZWxmRG9tYWluIjpudWxsLCJpYXQiOjE3NzA1NTA2NDd9.M0dwJGFMZGSCarnhhzL-Sk6vxGsAOxZRWvJ-5aZbhCcRAiCBEc7Afzuzx4yc7T4mxgPGQonZbPeRJrWZG1b4dronHCHILMF6mo7WI4LesWIpnvFQre2eZybxDhrIdt4RN3bbGSCsyalq65Tx99R_jUMNg4QvB2PrU3cq2Y5N-1zSmhvezMqhYk7mNstI9ITSH845le8wAxx6PsI-HoIwSG__bblFV2JplFq62416LDhbcVo9XNFqX0ECRfceJstdd9hYgTkVNM8QyD-s6ghnr-H9j5yiopE6pJHYJNguhSdDlcIUQMIBSfRS5wI7n2Xmt6FzkD5TYaSOZeuJ1pUdnA"; 
    
    const MAYAR_INVOICE_CREATE = "https://api.mayar.id/hl/v1/invoice/create";
    const MAYAR_INVOICE_LIST = "https://api.mayar.id/hl/v1/invoice"; 
    const MAYAR_INVOICE_DETAIL = "https://api.mayar.id/hl/v1/invoice"; // + /{id}
    
    // Base URL untuk Redirect (Tanpa Query Param)
    const BASE_REDIRECT_URL = "https://leonrdnxx.dev/detail-order.html";

    // --- SECURITY KEY (Ganti dengan password rahasia Anda) ---
    const ADMIN_SECRET = "KUNCI_RAHASIA_SUPER_AMAN_123";

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Admin-Secret",
    };

    // Handle OPTIONS request for CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    let path = url.pathname.replace(/\/\/+/g, '/'); 
    if (path.endsWith('/')) path = path.slice(0, -1);

    try {
      // --- ROUTE 1: CREATE TRANSACTION (Public) ---
      if (path === "/api/create-transaction" && request.method === "POST") {
        let reqBody;
        try {
            reqBody = await request.json();
        } catch (e) {
            throw new Error("Invalid JSON body");
        }

        // 1. Sanitize & Validate Input
        const customerName = reqBody.customerName ? reqBody.customerName.trim() : "";
        const customerEmail = reqBody.customerEmail ? reqBody.customerEmail.trim() : "";
        const customerPhone = reqBody.customerPhone ? reqBody.customerPhone.trim() : "0000000000";
        const amount = parseInt(reqBody.amount);
        const description = reqBody.description ? reqBody.description.trim() : "Order";

        if (!amount || !customerName || !customerEmail) {
          throw new Error("Data tidak lengkap: amount, customerName, dan customerEmail wajib diisi.");
        }

        if (amount < 1000) {
           throw new Error("Total pembayaran minimal Rp 1.000");
        }

        // Generate Custom Order ID (Unik)
        // Format: ORD-{timestamp}-{random4digit}
        const timestamp = Math.floor(Date.now() / 1000);
        const random = Math.floor(1000 + Math.random() * 9000);
        const orderId = `ORD-${timestamp}-${random}`;
        
        const expiredDate = new Date();
        expiredDate.setHours(expiredDate.getHours() + 24);

        // Redirect URL Dinamis dengan Order ID
        const dynamicRedirectUrl = `${BASE_REDIRECT_URL}?id=${orderId}`;

        const mayarPayload = {
          amount: amount, 
          type: "ONETIME", 
          description: `${description} [ID:${orderId}]`, // Masukkan ID ke deskripsi juga
          name: customerName,
          email: customerEmail,
          mobile: customerPhone,
          redirectUrl: dynamicRedirectUrl, // KUNCI: Redirect URL spesifik per order
          expiredAt: expiredDate.toISOString(),
          items: [
             {
               description: description,
               quantity: 1,
               rate: amount
             }
          ]
        };

        console.log("Sending payload to Mayar:", JSON.stringify(mayarPayload));

        const mayarResponse = await fetch(MAYAR_INVOICE_CREATE, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${MAYAR_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(mayarPayload)
        });

        const mayarResult = await mayarResponse.json();

        if (!mayarResponse.ok) {
          const errorMsg = mayarResult.messages || mayarResult.message || "Gagal menghubungi Mayar";
          console.error("Mayar API Error:", JSON.stringify(mayarResult));
          throw new Error(`Mayar Error: ${JSON.stringify(errorMsg)}`);
        }

        // Kembalikan Order ID kita sendiri, bukan ID Invoice Mayar (meskipun kita simpan juga nanti)
        return new Response(JSON.stringify({
          success: true,
          link: mayarResult.data.link,
          invoiceId: mayarResult.data.id, // ID Invoice Mayar (untuk referensi)
          orderId: orderId, // ID Order Kita (untuk Firestore & URL)
          status: mayarResult.status
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // --- ROUTE 2: CHECK INVOICE STATUS (Public but Safe) ---
      // Endpoint ini digunakan oleh detail-order.html untuk memverifikasi status pembayaran
      // Menerima parameter 'invoiceId' (ID Mayar)
      if (path === "/api/check-invoice" && request.method === "GET") {
        const invoiceId = url.searchParams.get("id");
        
        if (!invoiceId) {
            throw new Error("Invoice ID is required");
        }

        // Panggil API Mayar untuk cek detail invoice
        const mayarResponse = await fetch(`${MAYAR_INVOICE_DETAIL}/${invoiceId}`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${MAYAR_API_KEY}`,
            "Content-Type": "application/json"
          }
        });

        const mayarResult = await mayarResponse.json();

        if (!mayarResponse.ok) {
           throw new Error("Failed to fetch invoice from Mayar");
        }

        // Kita hanya kembalikan data penting saja ke frontend
        return new Response(JSON.stringify({
            success: true,
            id: mayarResult.data.id,
            status: mayarResult.data.status, // "PAID", "UNPAID", "EXPIRED", dll
            amount: mayarResult.data.amount,
            customerEmail: mayarResult.data.customer.email
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // --- ROUTE 3: WEBHOOK HANDLER (Public) ---
      if (path === "/api/webhook" && request.method === "POST") {
        const webhookData = await request.json();
        console.log("Webhook received:", JSON.stringify(webhookData));

        if (webhookData.event === "testing") {
             return new Response(JSON.stringify({ 
                 status: "success", 
                 message: "Webhook test received successfully!",
                 receivedData: webhookData
             }), {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        // Webhook hanya untuk logging atau trigger tambahan jika perlu
        // Logika utama update database ada di frontend (detail-order.html) yang diverifikasi via /api/check-invoice

        return new Response(JSON.stringify({ status: "received" }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      return new Response(JSON.stringify({ error: "Endpoint not found", path: path }), { 
        status: 404, 
        headers: corsHeaders 
      });

    } catch (err) {
      return new Response(JSON.stringify({
        success: false, 
        error: err.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  },
};
