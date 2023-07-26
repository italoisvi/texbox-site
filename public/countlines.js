const fs = require('fs');
const path = require('path');
const axios = require('axios');
const prompt = require('prompt-sync')({sigint: true});

// Get the repository URL from the user
const repoUrl = prompt('Enter the repository URL: ');

// Extract owner and repository name from the GitHub URL
const match = repoUrl.match(/github\.com\/(.+)\/(.+)/);
if (!match) {
  console.log(`Invalid GitHub repository URL: ${repoUrl}`);
  process.exit(1);
}

const owner = match[1];
const repoName = match[2];

// Make a request to the GitHub API to check if the repository exists
axios.get(`https://api.github.com/repos/${owner}/${repoName}`)
  .then(response => {
    if (response.status === 200) {
      // Get the default branch of the repository
      const defaultBranch = response.data.default_branch;

      // Get the tree of the default branch
      return axios.get(`https://api.github.com/repos/${owner}/${repoName}/git/trees/${defaultBranch}?recursive=1`);
    } else {
      console.log(`The repository '${repoUrl}' does not exist.`);
      process.exit(1);
    }
  })
  .then(response => {
    // Check if the response contains the 'tree' field
    if (!response.data.tree || !Array.isArray(response.data.tree)) {
      throw new Error('Failed to get the list of files from the repository.');
    }

    // Filter only the file paths from the tree
    const filePaths = response.data.tree.filter(item => item.type === 'blob').map(item => item.path);

    // Function to get the content of a file given its path
    const getFileContent = (filePath) => {
      return axios.get(`https://raw.githubusercontent.com/${owner}/${repoName}/master/${filePath}`, { responseType: 'text' })
        .then(fileResponse => fileResponse.data);
    };

    // Array to store promises for getting the content of each file
    const filePromises = filePaths.map(filePath => getFileContent(filePath));

    // Wait for all promises to resolve and get the file contents
    return Promise.all(filePromises);
  })
  .then(fileContents => {
    // Count the total lines of code from all files
    let linesOfCode = 0;
    for (const fileContent of fileContents) {
      linesOfCode += fileContent.split('\n').length;
    }

    // Print the number of lines of code
    console.log(`The repository '${repoUrl}' contains ${linesOfCode} lines of code.`);
  })
  .catch(error => {
    console.log(`Error while checking the repository: ${error.message}`);
    process.exit(1);
  });