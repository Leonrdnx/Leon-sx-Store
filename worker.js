export default {
  async fetch(request, env, ctx) {
    // --- KONFIGURASI ---
    const MAYAR_API_KEY = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxNzE0OGY1Ny1hMWQ1LTQ3YzYtYWYwOC1iNzhmMjUzNDFmNWUiLCJhY2NvdW50SWQiOiJhZTVjNGEzZi02MmIzLTQ1N2EtYmU0ZC1lNDM1NTkwMDEwMWUiLCJjcmVhdGVkQXQiOiIxNzcwNTUwNjQ3OTkwIiwicm9sZSI6ImRldmVsb3BlciIsInN1YiI6ImhhZmlkemFsZ292dXJAZ21haWwuY29tIiwibmFtZSI6Ikxlb24nc3ggU3RvcmUiLCJsaW5rIjoibGVvbnN4LXN0b3JlIiwiaXNTZWxmRG9tYWluIjpudWxsLCJpYXQiOjE3NzA1NTA2NDd9.M0dwJGFMZGSCarnhhzL-Sk6vxGsAOxZRWvJ-5aZbhCcRAiCBEc7Afzuzx4yc7T4mxgPGQonZbPeRJrWZG1b4dronHCHILMF6mo7WI4LesWIpnvFQre2eZybxDhrIdt4RN3bbGSCsyalq65Tx99R_jUMNg4QvB2PrU3cq2Y5N-1zSmhvezMqhYk7mNstI9ITSH845le8wAxx6PsI-HoIwSG__bblFV2JplFq62416LDhbcVo9XNFqX0ECRfceJstdd9hYgTkVNM8QyD-s6ghnr-H9j5yiopE6pJHYJNguhSdDlcIUQMIBSfRS5wI7n2Xmt6FzkD5TYaSOZeuJ1pUdnA"; 
    
    const MAYAR_INVOICE_CREATE = "https://api.mayar.id/hl/v1/invoice/create";
    const MAYAR_INVOICE_LIST = "https://api.mayar.id/hl/v1/invoice"; 
    const REDIRECT_URL = "https://leonrdnxx.dev/detail-order";

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

        // Validasi Input
        if (!reqBody.amount || !reqBody.customerName || !reqBody.customerEmail) {
          throw new Error("Data tidak lengkap: amount, customerName, dan customerEmail wajib diisi.");
        }

        if (parseInt(reqBody.amount) < 1000) {
           throw new Error("Total pembayaran minimal Rp 1.000");
        }

        const uniqueRef = Math.floor(Date.now() / 1000);
        const expiredDate = new Date();
        expiredDate.setHours(expiredDate.getHours() + 24);

        const mayarPayload = {
          amount: parseInt(reqBody.amount), 
          type: "ONETIME", 
          description: `${reqBody.description} [Ref:${uniqueRef}]`,
          name: reqBody.customerName,
          email: reqBody.customerEmail,
          mobile: reqBody.customerPhone || "0000000000",
          redirectUrl: REDIRECT_URL, 
          expiredAt: expiredDate.toISOString(),
          items: [
             {
               description: reqBody.description,
               quantity: 1,
               rate: parseInt(reqBody.amount)
             }
          ]
        };

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
          // Log error detail untuk debugging di dashboard worker
          console.error("Mayar Error:", JSON.stringify(mayarResult));
          throw new Error(errorMsg);
        }

        return new Response(JSON.stringify({
          success: true,
          link: mayarResult.data.link,
          id: mayarResult.data.id,
          status: mayarResult.status
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // --- ROUTE 2: LIST INVOICES (Protected) ---
      if (path === "/api/list-invoices" && request.method === "GET") {
        const clientSecret = request.headers.get("x-admin-secret") || request.headers.get("X-Admin-Secret");
        if (clientSecret !== ADMIN_SECRET) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: corsHeaders
            });
        }

        const params = url.searchParams;
        const page = params.get("page") || "1";
        const pageSize = params.get("pageSize") || "10";

        const mayarResponse = await fetch(`${MAYAR_INVOICE_LIST}?page=${page}&pageSize=${pageSize}`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${MAYAR_API_KEY}`,
            "Content-Type": "application/json"
          }
        });

        const mayarResult = await mayarResponse.json();

        if (!mayarResponse.ok) {
           return new Response(JSON.stringify({ 
             error: "Mayar API Error", 
             details: mayarResult,
             endpoint: MAYAR_INVOICE_LIST
           }), {
             status: 500,
             headers: { ...corsHeaders, "Content-Type": "application/json" }
           });
        }

        return new Response(JSON.stringify(mayarResult), {
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

        if (webhookData.event === "purchase" || (webhookData.data && webhookData.data.status === "PAID")) {
            return new Response(JSON.stringify({ 
                status: "success", 
                message: "Payment processed" 
            }), {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

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
      // Tangkap error dan kembalikan sebagai JSON agar frontend bisa membacanya
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