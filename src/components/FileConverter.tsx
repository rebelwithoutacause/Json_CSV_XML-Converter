import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Upload, RefreshCw, FileText, Database, Code } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type FileFormat = "json" | "csv" | "xml";

interface ConversionError {
  message: string;
  type: "error" | "warning";
}

const FileConverter = () => {
  const [inputData, setInputData] = useState("");
  const [outputData, setOutputData] = useState("");
  const [inputFormat, setInputFormat] = useState<FileFormat>("json");
  const [outputFormat, setOutputFormat] = useState<FileFormat>("csv");
  const [error, setError] = useState<ConversionError | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const { toast } = useToast();

  const formatIcons = {
    json: Code,
    csv: Database,
    xml: FileText,
  };

  const validateAndConvert = useCallback(() => {
    if (!inputData.trim()) {
      setError({ message: "Please enter some data to convert", type: "warning" });
      return;
    }

    setIsConverting(true);
    setError(null);

    try {
      let parsedData: any;

      // Parse input based on format
      if (inputFormat === "json") {
        try {
          parsedData = JSON.parse(inputData);
        } catch (e) {
          throw new Error("Invalid JSON format. Please check your syntax.");
        }
      } else if (inputFormat === "csv") {
        parsedData = parseCSV(inputData);
      } else if (inputFormat === "xml") {
        parsedData = parseXML(inputData);
      }

      // Convert to output format
      let convertedData: string;
      if (outputFormat === "json") {
        convertedData = JSON.stringify(parsedData, null, 2);
      } else if (outputFormat === "csv") {
        convertedData = convertToCSV(parsedData);
      } else if (outputFormat === "xml") {
        convertedData = convertToXML(parsedData);
      } else {
        throw new Error("Unsupported output format");
      }

      setOutputData(convertedData);
      toast({
        title: "Conversion successful!",
        description: `Successfully converted ${inputFormat.toUpperCase()} to ${outputFormat.toUpperCase()}`,
      });
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Conversion failed";
      setError({ message: errorMessage, type: "error" });
      setOutputData("");
    } finally {
      setIsConverting(false);
    }
  }, [inputData, inputFormat, outputFormat, toast]);

  const parseCSV = (csvData: string): any[] => {
    const lines = csvData.trim().split("\n");
    if (lines.length === 0) throw new Error("CSV data is empty");

    const headers = lines[0].split(",").map(h => h.trim().replace(/"/g, ""));
    const result = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map(v => v.trim().replace(/"/g, ""));
      if (values.length !== headers.length) {
        throw new Error(`Row ${i + 1} has ${values.length} columns, expected ${headers.length}`);
      }
      
      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index];
      });
      result.push(row);
    }

    return result;
  };

  const parseXML = (xmlData: string): any => {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlData, "text/xml");
      
      if (xmlDoc.getElementsByTagName("parsererror").length > 0) {
        throw new Error("Invalid XML format");
      }

      return xmlToObject(xmlDoc.documentElement);
    } catch (e) {
      throw new Error("Failed to parse XML data");
    }
  };

  const xmlToObject = (element: Element): any => {
    const result: any = {};

    if (element.children.length === 0) {
      return element.textContent;
    }

    for (let i = 0; i < element.children.length; i++) {
      const child = element.children[i];
      const childData = xmlToObject(child);

      if (result[child.tagName]) {
        if (Array.isArray(result[child.tagName])) {
          result[child.tagName].push(childData);
        } else {
          result[child.tagName] = [result[child.tagName], childData];
        }
      } else {
        result[child.tagName] = childData;
      }
    }

    return result;
  };

  const convertToCSV = (data: any): string => {
    if (!Array.isArray(data)) {
      throw new Error("CSV output requires array data");
    }

    if (data.length === 0) return "";

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(","),
      ...data.map(row => 
        headers.map(header => `"${row[header] || ""}"`).join(",")
      )
    ].join("\n");

    return csvContent;
  };

  const convertToXML = (data: any): string => {
    const objectToXml = (obj: any, rootName: string = "root"): string => {
      if (Array.isArray(obj)) {
        return obj.map(item => `<item>${objectToXml(item, "")}</item>`).join("\n");
      }

      if (typeof obj === "object" && obj !== null) {
        return Object.entries(obj)
          .map(([key, value]) => `<${key}>${objectToXml(value, "")}</${key}>`)
          .join("\n");
      }

      return String(obj);
    };

    return `<?xml version="1.0" encoding="UTF-8"?>\n<root>\n${objectToXml(data)}\n</root>`;
  };

  const handleDownload = () => {
    if (!outputData) {
      toast({
        title: "No data to download",
        description: "Please convert some data first",
        variant: "destructive",
      });
      return;
    }

    const blob = new Blob([outputData], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `converted.${outputFormat}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Download started",
      description: `File saved as converted.${outputFormat}`,
    });
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setInputData(content);
      
      // Auto-detect format based on file extension
      const extension = file.name.split('.').pop()?.toLowerCase();
      if (extension === 'json' || extension === 'csv' || extension === 'xml') {
        setInputFormat(extension as FileFormat);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-foreground">File Converter</h1>
        <p className="text-lg text-muted-foreground">
          Convert between JSON, CSV, and XML formats with validation and error handling
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Input Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Input Data
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Select value={inputFormat} onValueChange={(value: FileFormat) => setInputFormat(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(formatIcons).map(([format, Icon]) => (
                    <SelectItem key={format} value={format}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        {format.toUpperCase()}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <input
                type="file"
                accept=".json,.csv,.xml,.txt"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
              />
              <Button
                variant="outline"
                onClick={() => document.getElementById("file-upload")?.click()}
                className="flex-1"
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload File
              </Button>
            </div>

            <Textarea
              placeholder={`Enter your ${inputFormat.toUpperCase()} data here or upload a file...`}
              value={inputData}
              onChange={(e) => setInputData(e.target.value)}
              className="min-h-[300px] font-mono text-sm"
            />
          </CardContent>
        </Card>

        {/* Output Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Output Data
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Select value={outputFormat} onValueChange={(value: FileFormat) => setOutputFormat(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(formatIcons).map(([format, Icon]) => (
                    <SelectItem key={format} value={format}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        {format.toUpperCase()}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Button
                onClick={handleDownload}
                disabled={!outputData}
                variant="outline"
                className="flex-1"
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>

            <Textarea
              value={outputData}
              readOnly
              placeholder="Converted data will appear here..."
              className="min-h-[300px] font-mono text-sm bg-muted"
            />
          </CardContent>
        </Card>
      </div>

      {/* Convert Button */}
      <div className="flex justify-center">
        <Button 
          onClick={validateAndConvert}
          disabled={isConverting || !inputData.trim()}
          size="lg"
          className="min-w-[200px]"
        >
          {isConverting ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Converting...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Convert {inputFormat.toUpperCase()} to {outputFormat.toUpperCase()}
            </>
          )}
        </Button>
      </div>

      {/* Error Display */}
      {error && (
        <Alert variant={error.type === "error" ? "destructive" : "default"}>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default FileConverter;