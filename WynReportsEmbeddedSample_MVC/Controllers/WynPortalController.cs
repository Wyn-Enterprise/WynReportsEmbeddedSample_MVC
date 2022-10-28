using Microsoft.AspNetCore.Mvc;
using WynReportsEmbeddedSample_MVC.Models;

namespace WynReportsEmbeddedSample_MVC.Controllers
{
    public class WynPortalController : Controller
    {
        public IActionResult Index(string url, string username, string version)
        {
            ViewBag.WynParams = new WynUser() { WynUrl = url.TrimEnd('/'), Username = username, Version = version.ToString() };
            return View();
        }
    }
}
