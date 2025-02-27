using System.Net.Http.Headers;
using System.Text.Json;
using Google.Apis.Auth.OAuth2;

namespace MyVertexAiRest
{
    public partial class Program
    {
        private readonly static string API_ENDPOINT = GetEnvVar("API_ENDPOINT");
        private readonly static string PROJECT_ID = GetEnvVar("PROJECT_ID");
        private readonly static string MODEL_ID = GetEnvVar("MODEL_ID");
        private readonly static string LOCATION_ID = GetEnvVar("LOCATION_ID");
        private readonly static string PUBLISHER = GetEnvVar("PUBLISHER");
        private readonly static string SERVICE_ACCOUNT_FILE_PATH = GetEnvVar("SERVICE_ACCOUNT_FILE_PATH");
        private readonly static string SCOPES = GetEnvVar("SCOPES");
        private readonly static string CANDIDATE_COUNT = GetEnvVar("CANDIDATE_COUNT");
        private readonly static string MAX_OUTPUT_TOKENS = GetEnvVar("MAX_OUTPUT_TOKENS");
        private readonly static string TEMPERATURE = GetEnvVar("TEMPERATURE");
        private readonly static string TOP_P = GetEnvVar("TOP-P");
        private readonly static string SEED = GetEnvVar("SEED");
        private readonly static string CONTEXT = GetEnvVar("CONTEXT");

        private static void Main(string[] args)
        {
            using HttpClient client = new();
            using StringContent jsonRequestBody = new(
                JsonSerializer.Serialize(new
                {
                    contents = BuildContents(),
                    systemInstruction = new
                    {
                        parts = new[]
                        {
                            new
                            {
                                text = CONTEXT,
                            },
                        },
                    },
                    generationConfig = new
                    {
                        temperature = TEMPERATURE,
                        maxOutputTokens = MAX_OUTPUT_TOKENS,
                        topP = TOP_P,
                        seed = SEED,
                        candidateCount = CANDIDATE_COUNT,
                    },
                    safetySettings = new[]
                    {
                        new
                        {
                            category = "HARM_CATEGORY_HATE_SPEECH",
                            threshold = "OFF",
                        },
                        new
                        {
                            category = "HARM_CATEGORY_DANGEROUS_CONTENT",
                            threshold = "OFF",
                        },
                        new
                        {
                            category = "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                            threshold = "OFF",
                        },
                        new
                        {
                            category = "HARM_CATEGORY_HARASSMENT",
                            threshold = "OFF",
                        },
                    },
                })
            );

            string accessToken = GetAccessToken(SERVICE_ACCOUNT_FILE_PATH);
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

            HttpResponseMessage response = client.PostAsync(
                $"https://{API_ENDPOINT}/v1/projects/{PROJECT_ID}/locations/{LOCATION_ID}/publishers/{PUBLISHER}/models/{MODEL_ID}:streamGenerateContent",
                jsonRequestBody
            ).Result;

            var result = response.Content.ReadAsStringAsync().Result;
            Console.WriteLine(result);

            Main(args);
        }

        private static string GetAccessToken(string serviceAccountFilePath)
        {
            using Stream stream = new FileStream(serviceAccountFilePath, FileMode.Open, FileAccess.Read);

            return GoogleCredential.FromStream(stream)
                .CreateScoped([SCOPES])
                .UnderlyingCredential.GetAccessTokenForRequestAsync().Result;
        }

        private static dynamic BuildContents()
        {
            string jsonContents = File.ReadAllText("MyVertexAiRest/contents.json")
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