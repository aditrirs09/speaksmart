# Let's switch to Cohere AI as a free alternative
# Step-by-step Flask backend change for your `app.py`

from flask import Flask, request, jsonify
import cohere
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Replace with your Cohere API Key (free tier available)
COHERE_API_KEY = "UFK7rf16GTLggFBwpE96zpzCM3jZeUwqBd7eX4SY"
co = cohere.Client(COHERE_API_KEY)

@app.route('/generate-question', methods=['POST'])
def generate_question():
    try:
        data = request.get_json()
        category = data.get('category', 'behavior')

        prompt = f"Generate a {category} interview question."

        response = co.generate(
            model='command-r',
            prompt=prompt,
            max_tokens=50,
            temperature=0.7
        )

        question = response.generations[0].text.strip()
        return jsonify({'question': question})

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)





