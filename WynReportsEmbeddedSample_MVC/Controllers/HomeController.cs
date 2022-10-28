using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json;
using System.Diagnostics;
using System.Net.Http.Headers;
using WynReportsEmbeddedSample_MVC.Models;

namespace WynReportsEmbeddedSample_MVC.Controllers
{
    public class HomeController : Controller
    {
        private readonly ILogger<HomeController> _logger;
        [BindProperty]
        public new WynUser User { get; set; }
        public HomeController(ILogger<HomeController> logger)
        {
            _logger = logger;
        }

        public IActionResult Index()
        {
            return View();
        }

        [HttpPost]
        public IActionResult Index([Bind] WynUser user)
        {
            var request = new HttpRequestMessage(HttpMethod.Post, user.WynUrl.TrimEnd('/') + "/connect/token");

            Dictionary<string, string> body = new Dictionary<string, string>();
            body.Add("grant_type", "password");
            body.Add("username", User.Username);
            body.Add("password", User.Password);
            body.Add("client_id", "integration");
            body.Add("client_secret", "eunGKas3Pqd6FMwx9eUpdS7xmz");

            request.Content = new FormUrlEncodedContent(body);

            request.Content.Headers.ContentType = new MediaTypeHeaderValue("application/x-www-form-urlencoded");

            var client = new HttpClient(); //_clientFactory.CreateClient();
            var response = client.Send(request);

            if (response.IsSuccessStatusCode)
            {
                WynUser.BaseWynUrl = User.WynUrl;
                var res = response.Content.ReadAsStringAsync();
                var resJson = JsonConvert.DeserializeObject<Token>(res.Result);
                WynUser.AccessToken = resJson.Access_Token;

                var requestConfig = new HttpRequestMessage(HttpMethod.Get, user.WynUrl.TrimEnd('/') + "/api/dashboards/config?token=" + resJson.Access_Token);
                var configClient = new HttpClient();
                var configResponse = configClient.Send(requestConfig);

                if (configResponse.IsSuccessStatusCode)
                {
                    var configres = configResponse.Content.ReadAsStringAsync();
                    var configresJson = JsonConvert.DeserializeObject<WynConfig>(configres.Result);
                    string wynVersion = configresJson.Version;
                    return RedirectToAction("Index", "WynPortal", new { url = User.WynUrl, username = User.Username, version = wynVersion });
                }
                return View();
            }
            else
            {
                Console.Write(response.ReasonPhrase);
                return View();
            }
        }

        public IActionResult Privacy()
        {
            return View();
        }

        [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
        public IActionResult Error()
        {
            return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
        }
    }
}