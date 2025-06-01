<h1 align="center">
  <a href="https://puter.com/app/github-quick-deploy" target="_blank">GitHub Quick Deploy</a>
</h1>

<p align="center">A web application for instantly deploying GitHub repositories to Puter hosting with zero configuration.
</p>

<p align="center">
  <img src="screenshot.png" alt="Screenshot" width="600" />
</p>

<br>

## Features

- **One-Click Deployment**: Deploy any GitHub repository to a live website in seconds
- **No Configuration Required**: Works with any static website repository
- **Deployment History**: Track all previous deployments
- **Instant Live URLs**: Automatic subdomain generation for each deployment
- **Persistent Storage**: All deployments saved to the user's Puter account
- **Modern UI**: Clean, responsive interface built with vanilla JavaScript

<br>

## Getting Started

Clone the repository: 

```bash
git clone https://github.com/puter-apps/deploy-from-github.git
```

and open the `index.html` file in any hosted environment.

<br>

## How It Works

GitHub Quick Deploy leverages [**Puter.js**](https://developer.puter.com/) to overcome several challenges in web-based deployment:

1. **Repository Access**: Uses Puter's networking capabilities to make cross-origin requests to GitHub's API, bypassing CORS restrictions

2. **File System Operations**: Employs Puter's file system API to create directories and write files

3. **Web Hosting**: Utilizes Puter's hosting capabilities to instantly publish static sites

4. **Persistent Storage**: Saves deployment history using Puter's key-value store

<br>

## License

MIT
