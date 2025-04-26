# Echo Link

## Inspiration
Since most network infrastructures are down, we needed to come up with our own solutions and infrastrucutres. This led us to creating a website. Using a link with the server, users can communicate with each other with a qr code. With the majority of our inspiration coming from social media apps such as Whatsapp, WeChat, Instagram, and Discord, we were able to implement our idea effectively. With this simple webapp, we were able to connect our chats to everyone around the world. Our inspiration from the Arduino came form an Apple Watch, which is another remote device that can display messages and gives a ping when a notification arrives. 

---

## What it Does
This project has multiple features. Throughout the first couple of hours, we worked on the ability to allow multiple users to join on the same chatroom and communicate, after which we allowed users to access voice chat through the same room. After completing the basic functionality of our project, we decided to enable users to send emojis to each other. Next, we spent a large portion of our time working on the hardware part of our project, which is where users recieve message notifications contianing both a buzzer sound and displaying the actual message. Furthermore, we added a title page with buttons that lead to two options: either creating a chatroom or joining one. Finally, we did some frontend to make sure the program looked smooth.

## How We Built It
For our project, we used Github to store our code and Visual Studio Code as our editor. For external help, we decided to utilize Cursor, which was an AI code editor that we utilized when it was required. We also used nGrok. Furthermore, to compose our hardware code we utilized Arduino IDE to store the code. We began by coding the messaging system on our webapp. After that, we decided to make a voice chat on our website. Then, our goal was to add an emoji system on our webapp after which we added hardware thorugh our Arduino. Finally, we ended up working on our user interface and fixing up the front end. With the assistance of ChatGPT we were able to generate a project plan that allowed us to finish this project as per the deadline. Through working on our ideas on Friday after planning a meeting with our group, we were able to get a head start.

We used Javascript, HTML, CSS, and ino.


---

## Challenges We Ran Into
- In the beginning the greatest issue we faced was the fact that we couldn't get everyone on the same chat and communicate togther. This took us a considerable amount of time to fix, but was fixed after changing the socket. 
- Another issue we faced was the fact that our voice communications section of the code was failing to work.
- The hardware was bugging out a lot. We tried to reconnect the wires multiple times and edit the code but nothing changed. Finally, we found out that the potentiometer was causing the change because it was from a different set. We didn't need it so we just removed it.

---

## Accomplishments We’re Proud Of
- Adding voicechat

---

## What We Learned
- How to use Arduinos
- How to program Arduinos
- How to make offline qr codes

---

## What’s Next for Echo Link
- Image sending
- Profile pictures

---

## Running Locally
In order to run Echo Link locally:
- Clone the repository and cd into it
- run:
```bash
node server.js
```

Keep in mind that you have to use ngrok in order to expose your localhost to anyone

Open the link that ngrok generates