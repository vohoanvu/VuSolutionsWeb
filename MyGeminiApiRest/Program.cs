
using System.Globalization;
using System.Text.Json;
using Google.Apis.Auth.OAuth2;

namespace MyGeminiApiRest
{
    public static class Program
    {
        private static void Main(string[] args)
        {
            string API_KEY = GetEnvVar("API_KEY");
            string MODEL_ID = GetEnvVar("MODEL_ID");
            double TEMPERATURE = Convert.ToDouble(GetEnvVar("TEMPERATURE"));
            double TOP_P = Convert.ToDouble(GetEnvVar("TOP-P"));
            int MAX_OUTPUT_TOKENS = Convert.ToInt32(GetEnvVar("MAX_OUTPUT_TOKENS"));
            int TOP_K = Convert.ToInt32(GetEnvVar("TOP-K"));

            Thread.CurrentThread.CurrentCulture = CultureInfo.GetCultureInfo("en-US");

            using HttpClient client = new();
            using StringContent jsonRequestBody = new(
                JsonSerializer.Serialize(new
                {
                    contents = BuildContents(),
                    safetySettings = new[]
                    {
                        new
                        {
                            category = "HARM_CATEGORY_HARASSMENT",
                            threshold = "BLOCK_NONE",
                        },
                        new
                        {
                            category = "HARM_CATEGORY_HATE_SPEECH",
                            threshold = "BLOCK_NONE",
                        },
                        new
                        {
                            category = "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                            threshold = "BLOCK_NONE",
                        },
                        new
                        {
                            category = "HARM_CATEGORY_DANGEROUS_CONTENT",
                            threshold = "BLOCK_NONE",
                        },
                        new
                        {
                            category = "HARM_CATEGORY_CIVIC_INTEGRITY",
                            threshold = "BLOCK_NONE",
                        },
                    },
                    generationConfig = new {
                        temperature = TEMPERATURE,
                        topP = TOP_P,
                        maxOutputTokens = MAX_OUTPUT_TOKENS,
                        topK = TOP_K,
                    },
                })
            );
        
            HttpResponseMessage response = client.PostAsync(
                $"https://generativelanguage.googleapis.com/v1beta/models/{MODEL_ID}:generateContent?key={API_KEY}",
                jsonRequestBody
            ).Result;

            string result = response.Content.ReadAsStringAsync().Result;
            Console.WriteLine(result);

            Main(args);
        }

        private static dynamic BuildContents()
        {
            string jsonContents = File.ReadAllText("MyVertexAiRest/contents.json")
                .Replace("{CONTEXT}", GetEnvVar("CONTEXT"))
                .Replace("{USER_PROMPT}", GetPrompt());

            return JsonSerializer.Deserialize<dynamic[]>(jsonContents)!;
        }

        private static string GetPrompt()
        {
            Console.WriteLine("Enter your prompt: ");
            return Console.ReadLine()!;
        }

        private static string GetEnvVar(string variableName)
        {
            return Environment.GetEnvironmentVariable(variableName) 
                   ?? throw new ArgumentNullException(variableName, $"Environment variable '{variableName}' is not set.");
        }
    }
}