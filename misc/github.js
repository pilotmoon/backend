import axios from 'axios';

const getRepoContents = async (owner, repo) => {
  try {
    const response = await axios({
      method: 'get',
      url: `https://api.github.com/repos/${owner}/${repo}/contents`,
      headers: {
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    // Print file names
    response.data.forEach((file) => {
      console.log(file.name);
    });

  } catch (err) {
    console.error(err);
  }
};

getRepoContents('pilotmoon', 'PopClip-Extensions');
