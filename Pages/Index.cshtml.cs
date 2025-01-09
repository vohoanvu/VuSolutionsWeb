using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using System.ComponentModel.DataAnnotations;

namespace VuSolutionsWeb.Pages
{
    public class IndexModel : PageModel
    {
        [BindProperty]
        public ContactForm Contact { get; set; } = new();

        public void OnGet()
        {
        }

        public IActionResult OnPost()
        {
            if (!ModelState.IsValid)
            {
                return Page();
            }

            // TODO: Add your email sending logic here

            return RedirectToPage();
        }

        public class ContactForm
        {
            [Required(ErrorMessage = "Name is required")]
            [StringLength(30, MinimumLength = 3)]
            public string Name { get; set; } = string.Empty;

            [Required(ErrorMessage = "Email is required")]
            [EmailAddress(ErrorMessage = "Invalid email address")]
            public string EmailAddress { get; set; } = string.Empty;

            [Phone]
            public string? Phone { get; set; }

            [Required(ErrorMessage = "Message is required")]
            public string Message { get; set; } = string.Empty;
        }
    }
}