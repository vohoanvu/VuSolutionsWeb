using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace VuSolutionsWeb.Pages.Home
{
    public class ContactModel : PageModel
    {
        [BindProperty]
        public ContactForm Input { get; set; } = default!;

        public void OnGet()
        {
        }

        public IActionResult OnPost()
        {
            if (!ModelState.IsValid)
            {
                return Page();
            }

            // Process the contact form
            // TODO: Add your email sending logic here

            return RedirectToPage("/Index");
        }
    }

    public class ContactForm
    {
        [Required(ErrorMessage = "Name is required")]
        [StringLength(30, MinimumLength = 3)]
        public string Name { get; set; } = string.Empty;

        [Required(ErrorMessage = "Email is required")]
        [EmailAddress(ErrorMessage = "Email is invalid!")]
        public string EmailAddress { get; set; } = string.Empty;

        [Phone]
        public string? Phone { get; set; }

        [Required]
        public string Message { get; set; } = string.Empty;
    }
}