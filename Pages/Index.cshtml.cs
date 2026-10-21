using Microsoft.AspNetCore.Mvc.RazorPages;

namespace VuSolutionsWeb.Pages
{
    // The contact form posts to the Cloudflare Worker (/api/contact in src/worker.js), not to this page.
    public class IndexModel : PageModel
    {
        public void OnGet()
        {
        }
    }
}
