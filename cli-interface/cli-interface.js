import figlet from "figlet";
import gradient, { teen } from "gradient-string";
import inquirer from "inquirer";
import ora from "ora";
import chalk from "chalk";
import { sendMessage, socket } from './client-server.js'
import readAllFiles from "./readAndCompress.js";

const sleep = (ms = 2000) => new Promise((r) => setTimeout(r, ms));

let isLLMReady = false;
let isProcessingUpload = false;

// Handle different socket events
socket.on('stream_chunk', (chunk) => {
    if(chunk.error){
        console.log(chalk.red.bold("\n CLI detected error:"), chalk.red(chunk.error))
        return
    }
    if(chunk.isComplete){
        console.log(chalk.green.bold("\n Response finished!"))
    } else {
        process.stdout.write(chalk.blueBright(chunk.data))  
    }
})

// For when files are uploaded
socket.on('llm-ready', (data) => {
    isLLMReady = true;
    console.log(chalk.green.bold("\n Success:"), chalk.cyan(data.message));
})

// To check if code files are given as context or no
socket.on('connection-status', (status) => {
    isLLMReady = status.hasCodeFile;
    if (!isLLMReady) {
        console.log(chalk.cyan.bold("\n Status:"), chalk.cyan(status.message));
    }
})

const startApp = async () => {
    console.clear()
    
    const spinner = ora(chalk.cyan('Loading Vita...')).start();
    await sleep(2000);
    spinner.stop();

    figlet('Vita Is Here', async (err, data) => {
        if (err) {
            console.log(chalk.red.bold('Something went wrong'));
            console.log(chalk.red(err));
            return;
        }

        console.clear();
        console.log(teen(data));
        
        console.log(chalk.cyan('\n Any broken code for me to fix ??'));
        console.log(chalk.cyan('Let\'s get started with your code analysis journey!\n'));
        
        await sleep(1000);

        // Main application loop
        while (true) {
            try {
                
                const choices = isLLMReady 
                    ? [
                        chalk.cyan('Ask a question about your code'),
                        chalk.cyan('Upload new code files'), 
                        chalk.cyan('Check status'),
                        chalk.red('Quit')
                      ]
                    : [
                        chalk.cyan('Upload code files (Required first step)'),
                        chalk.cyan('Check status'),
                        chalk.red('Quit')
                      ];

                const { action } = await inquirer.prompt([
                    {
                        type: 'list',
                        name: 'action',
                        message: chalk.cyan('What would you like to do?'),
                        choices: choices,
                        prefix: chalk.cyan('>')
                    }
                ]);

                if (action.includes('Quit')) {
                    console.log(chalk.cyan('Thank you for using Vita! Goodbye!'));
                    process.exit(0);
                }

                if (action.includes('Check status')) {
                    if (isLLMReady) {
                        console.log(chalk.green.bold('Status:'), chalk.cyan('LLM is ready! Your code files are loaded.'));
                    } else {
                        console.log(chalk.cyan.bold('Status:'), chalk.cyan('Waiting for code files to be uploaded.'));
                    }
                    continue;
                }

                if (action.includes('Upload')) {
                    await handleCodeUpload();
                    continue;
                }

                if (action.includes('Ask a question')) {
                    await handleChatMode();
                    continue;
                }

            } catch (error) {
                console.error(chalk.red.bold('An error occurred:'), chalk.red(error.message));
                await sleep(1000);
            }
        }
    });
};

const handleCodeUpload = async () => {
    if (isProcessingUpload) {
        console.log(chalk.cyan('Upload already in progress...'));
        return;
    }

    console.log(chalk.cyan('\nPreparing to upload your code files...'));
    
    const { confirm } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'confirm',
            message: chalk.cyan('This will scan your current directory and upload all code files. Continue?'),
            default: true,
            prefix: chalk.cyan('?')
        }
    ]);

    if (!confirm) {
        console.log(chalk.cyan('Upload cancelled.'));
        return;
    }

    isProcessingUpload = true;
    const uploadSpinner = ora({
        text: chalk.cyan('Reading and compressing code files...'),
        color: 'cyan',
        spinner: 'dots12'
    }).start();

    try {
        await readAllFiles(process.cwd());
        uploadSpinner.succeed(chalk.green.bold('Code files uploaded successfully!'));
        console.log(chalk.cyan('LLM is processing your code...'));
        
    } catch (error) {
        uploadSpinner.fail(chalk.red.bold('Failed to upload code files'));
        console.error(chalk.red('Error:'), chalk.red(error.message));
    } finally {
        isProcessingUpload = false;
    }
};

const handleChatMode = async () => {
    if (!isLLMReady) {
        console.log(chalk.red.bold('Please upload code files first!'));
        return;
    }

    console.log(chalk.cyan('Entering Chat Mode...'));
    console.log(chalk.cyan.bold('Chat Mode'), chalk.cyan('- Ask questions about your code'));
    console.log(chalk.cyan('Type "back" to return to menu\n'));

    while (true) {
        const { query } = await inquirer.prompt([
            {
                type: 'input',
                name: 'query',
                message: chalk.cyan('Your question:'),
                prefix: chalk.cyan('>'),
                validate: (input) => {
                    if (!input.trim()) {
                        return chalk.red('Please enter a question.');
                    }
                    return true;
                },
                transformer: (input) => {
                    return chalk.cyan(input);
                }
            }
        ]);

        if (query.toLowerCase().trim() === 'back') {
            console.log(chalk.cyan('Returning to main menu...\n'));
            break;
        }

        console.log(chalk.cyan('Vita is thinking...\n'));
        sendMessage(query);
        
        // Wait for response to complete before allowing next question
        await new Promise((resolve) => {
            const responseHandler = (chunk) => {
                if (chunk.isComplete || chunk.error) {
                    socket.off('stream_chunk', responseHandler);
                    resolve();
                }
            };
            socket.on('stream_chunk', responseHandler);
        });

        console.log(chalk.cyan('\n' + '─'.repeat(60) + '\n'));
    }
};

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
    console.log(chalk.cyan('\n\nDetected Ctrl+C, exiting gracefully...'));
    process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    console.error(chalk.red.bold('\nUnexpected error:'), chalk.red(error.message));
    process.exit(1);
});

startApp();