using System.ComponentModel.DataAnnotations;

namespace WynReportsEmbeddedSample_MVC.Models
{
    public class WynUser
    {
        [Required]
        public static string BaseWynUrl { get; set; }
        public static string AccessToken { get; set; }
        [Required]
        public string WynUrl { get; set; }
        [Required]
        public string Username { get; set; }
        [Required]
        public string Password { get; set; }
        public string DashboardId { get; set; }
        public string Version { get; set; }
    }
}
